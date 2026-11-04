from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_owner
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/staff", tags=["Admin Staff Management (Owner)"])


@router.get("", response_model=list[UserOut])
async def list_staff_users(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_owner)
):
    stmt = (
        select(User).where(User.is_deleted == False).order_by(User.role.asc(), User.full_name.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("", response_model=UserOut)
async def create_staff_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    # Check duplicate email/phone
    exist_stmt = select(User).where(
        (User.email == data.email.lower()) | (User.phone == data.phone), User.is_deleted == False
    )
    exist = (await db.execute(exist_stmt)).scalar_one_or_none()
    if exist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email or phone already exists",
        )

    user = User(
        email=data.email.lower(),
        phone=data.phone,
        full_name=data.full_name,
        role=data.role,
        is_active=data.is_active,
        hashed_password=get_password_hash(data.password),
        force_password_change=True,  # Force change on first login
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await log_audit_event(
        db,
        action="create_staff",
        entity_type="user",
        entity_id=user.id,
        details={"name": user.full_name, "role": user.role, "email": user.email},
        user=current_user,
    )
    return user


@router.put("/{user_id}", response_model=UserOut)
async def update_staff_user(
    user_id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    user = await db.get(User, user_id)
    if not user or user.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_dict = data.model_dump(exclude_unset=True)
    if update_dict.get("password"):
        user.hashed_password = get_password_hash(update_dict.pop("password"))

    for k, v in update_dict.items():
        if k == "email" and v:
            setattr(user, k, v.lower())
        else:
            setattr(user, k, v)

    await db.commit()
    await db.refresh(user)

    await log_audit_event(
        db,
        action="update_staff",
        entity_type="user",
        entity_id=user.id,
        details={"updated_fields": list(update_dict.keys())},
        user=current_user,
    )
    return user


@router.delete("/{user_id}", response_model=MessageResponse)
async def deactivate_staff_user(
    user_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_owner)
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate own account"
        )

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False
    user.is_deleted = True
    await db.commit()

    await log_audit_event(
        db,
        action="delete_staff",
        entity_type="user",
        entity_id=user.id,
        details={"name": user.full_name},
        user=current_user,
    )
    return MessageResponse(message=f"Account for {user.full_name} deactivated")
