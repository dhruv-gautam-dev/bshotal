from datetime import datetime

from pydantic import EmailStr, Field

from app.schemas.common import BaseSchema


class UserBase(BaseSchema):
    email: EmailStr
    phone: str = Field(..., pattern=r"^(\+91[\-\s]?)?[6-9]\d{9}$")
    full_name: str
    role: str = Field("staff", pattern="^(owner|manager|staff)$")
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseSchema):
    email: EmailStr | None = None
    phone: str | None = None
    full_name: str | None = None
    role: str | None = Field(None, pattern="^(owner|manager|staff)$")
    is_active: bool | None = None
    password: str | None = Field(None, min_length=6)


class UserOut(UserBase):
    id: str
    force_password_change: bool
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
