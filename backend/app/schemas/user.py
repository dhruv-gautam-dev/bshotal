import re
from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import BaseSchema


class UserBase(BaseSchema):
    email: EmailStr
    phone: str = Field(..., pattern=r"^(\+?[1-9]\d{6,14}|[6-9]\d{9})$")
    full_name: str
    role: str = Field("staff", pattern="^(owner|manager|staff|admin)$")
    is_active: bool = True

    @field_validator("phone", mode="before")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        if isinstance(v, str):
            return re.sub(r"[\s\-]", "", v.strip())
        return str(v)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseSchema):
    email: EmailStr | None = None
    phone: str | None = None
    full_name: str | None = None
    role: str | None = Field(None, pattern="^(owner|manager|staff|admin)$")
    is_active: bool | None = None
    password: str | None = Field(None, min_length=6)

    @field_validator("phone", mode="before")
    @classmethod
    def clean_phone_update(cls, v: str | None) -> str | None:
        if isinstance(v, str) and v.strip():
            return re.sub(r"[\s\-]", "", v.strip())
        return v


class UserOut(BaseSchema):
    id: str
    email: str
    phone: str
    full_name: str
    role: str
    is_active: bool = True
    force_password_change: bool = False
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
