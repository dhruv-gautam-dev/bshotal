from datetime import datetime
from decimal import Decimal

from pydantic import EmailStr, Field

from app.schemas.common import BaseSchema


class CustomerBase(BaseSchema):
    phone: str = Field(..., pattern=r"^(\+?[1-9]\d{6,14}|[6-9]\d{9})$")
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr | None = None
    address: str | None = None
    is_vip: bool = False
    notes: str | None = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseSchema):
    name: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    is_vip: bool | None = None
    notes: str | None = None


class CustomerOut(CustomerBase):
    id: str
    total_bookings_count: int
    total_orders_count: int
    total_spent: Decimal
    created_at: datetime
    updated_at: datetime
