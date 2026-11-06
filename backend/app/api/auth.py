import re
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.core.rate_limit import login_protector
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    hash_token,
    verify_password,
)
from app.models.user import RefreshToken, User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserOut
from app.utils.email import send_email

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
async def login(req: Request, credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    ip = req.client.host if req.client else "unknown"
    lockout_key = f"{credentials.username}:{ip}"

    if login_protector.is_locked(lockout_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Account temporarily locked for 10 minutes.",
        )

    # Allow login by email OR phone (supports spaces, dashes, or local formats)
    clean_username = credentials.username.strip()
    clean_phone = re.sub(r"[\s\-]", "", clean_username)
    phone_variants = [clean_username, clean_phone]
    if clean_phone.startswith("+91") and len(clean_phone) == 13:
        phone_variants.append(clean_phone[3:])
    elif not clean_phone.startswith("+") and len(clean_phone) == 10:
        phone_variants.append(f"+91{clean_phone}")

    stmt = select(User).where(
        or_(
            User.email == clean_username.lower(),
            User.phone.in_(phone_variants),
        ),
        User.is_deleted == False,
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        login_protector.record_failure(lockout_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email/phone or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is deactivated"
        )

    # Reset brute force failures
    login_protector.reset(lockout_key)

    user.last_login_at = datetime.now(UTC)

    # Generate tokens
    access_token = create_access_token(subject=user.id, role=user.role)
    refresh_token = create_refresh_token(subject=user.id)

    # Store hashed refresh token in DB
    ref_model = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(ref_model)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user.id,
            "email": user.email,
            "phone": user.phone,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "force_password_change": user.force_password_change,
        },
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(data.refresh_token)
        user_id: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")
        if not user_id or token_type != "refresh":
            raise ValueError()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        )

    # Check database for revoked or matched token
    t_hash = hash_token(data.refresh_token)
    stmt = select(RefreshToken).where(
        RefreshToken.token_hash == t_hash, RefreshToken.is_revoked == False
    )
    res = await db.execute(stmt)
    token_record = res.scalar_one_or_none()
    if not token_record or token_record.expires_at < datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or expired"
        )

    # Rotate refresh token: revoke current
    token_record.is_revoked = True

    user = await db.get(User, user_id)
    if not user or not user.is_active or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer active"
        )

    new_access_token = create_access_token(subject=user.id, role=user.role)
    new_refresh_token = create_refresh_token(subject=user.id)

    new_token_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_token_record)
    await db.commit()

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user={
            "id": user.id,
            "email": user.email,
            "phone": user.phone,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
            "force_password_change": user.force_password_change,
        },
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    data: RefreshTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    t_hash = hash_token(data.refresh_token)
    stmt = select(RefreshToken).where(
        RefreshToken.token_hash == t_hash, RefreshToken.user_id == current_user.id
    )
    res = await db.execute(stmt)
    token_record = res.scalar_one_or_none()
    if token_record:
        token_record.is_revoked = True
        await db.commit()
    return MessageResponse(message="Successfully logged out")


@router.get("/me", response_model=UserOut)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password does not match"
        )
    current_user.hashed_password = get_password_hash(data.new_password)
    current_user.force_password_change = False
    await db.commit()
    return MessageResponse(message="Password changed successfully")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == data.email.lower(), User.is_deleted == False)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if user:
        reset_token = create_access_token(
            subject=user.id,
            role="reset",
            expires_delta=timedelta(hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS),
        )
        await send_email(
            to_email=user.email,
            subject="B.S. Hotel & Restaurant - Password Reset Request",
            html_content=(
                f"<p>Hello {user.full_name},</p>"
                f"<p>Use the following one-time reset token to reset your password:</p>"
                f"<p><code>{reset_token}</code></p>"
                f"<p>This token expires in {settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS} hours.</p>"
            ),
        )
    return MessageResponse(
        message="If an account exists with this email, password reset instructions have been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(data.token)
        user_id = payload.get("sub")
        role = payload.get("role")
        if not user_id or role != "reset":
            raise ValueError()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token"
        )

    user = await db.get(User, user_id)
    if not user or not user.is_active or user.is_deleted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    user.hashed_password = get_password_hash(data.new_password)
    user.force_password_change = False
    await db.commit()
    return MessageResponse(message="Password reset successful. You may now log in.")
