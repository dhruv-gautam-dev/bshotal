"""
OPTIONAL CUSTOMER AUTHENTICATION MODULE
Guests do NOT need an account to book rooms or order food.
This module is provided for returning customers who wish to save addresses and view personal history.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.customer import Customer
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.customer import CustomerCreate, CustomerOut

router = APIRouter(prefix="/customer-auth", tags=["Customer Auth (Optional)"])


@router.post("/register", response_model=CustomerOut)
async def register_customer(
    data: CustomerCreate, password: str, db: AsyncSession = Depends(get_db)
):
    stmt = select(Customer).where(Customer.phone == data.phone)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        if existing.hashed_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer account with this phone already exists",
            )
        existing.hashed_password = get_password_hash(password)
        existing.name = data.name
        existing.email = data.email
        await db.commit()
        await db.refresh(existing)
        return existing

    customer = Customer(
        phone=data.phone,
        name=data.name,
        email=data.email,
        address=data.address,
        hashed_password=get_password_hash(password),
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.post("/login", response_model=TokenResponse)
async def login_customer(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(Customer).where(Customer.phone == credentials.username)
    res = await db.execute(stmt)
    customer = res.scalar_one_or_none()

    if (
        not customer
        or not customer.hashed_password
        or not verify_password(credentials.password, customer.hashed_password)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(subject=customer.id, role="customer")
    return TokenResponse(
        access_token=token,
        refresh_token="",
        token_type="bearer",
        expires_in=86400,
        user={
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
            "role": "customer",
        },
    )
