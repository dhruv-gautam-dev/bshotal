from datetime import date, datetime
from decimal import Decimal

from pydantic import EmailStr, Field

from app.schemas.common import BaseSchema


class EnquiryCreatePublic(BaseSchema):
    customer_name: str = Field(..., min_length=2, max_length=100)
    customer_phone: str = Field(..., pattern=r"^(\+?[1-9]\d{6,14}|[6-9]\d{9})$")
    customer_email: EmailStr | None = None
    event_type: str = Field("custom", pattern="^(ring|birthday|wedding|custom|contact)$")
    event_date: date | None = None
    guest_count: int | None = Field(None, ge=1)
    budget: Decimal | None = Field(None, ge=0)
    message: str = Field(..., min_length=5)
    honeypot: str | None = None


class EnquiryPublicResponse(BaseSchema):
    enquiry_reference: str
    customer_name: str
    customer_phone: str
    message: str


class EnquiryUpdateAdmin(BaseSchema):
    status: str | None = Field(None, pattern="^(new|contacted|quote_sent|confirmed|lost)$")
    assigned_to_user_id: str | None = None
    admin_notes: str | None = None


class EnquiryOut(BaseSchema):
    id: str
    enquiry_reference: str
    customer_name: str
    customer_phone: str
    customer_email: str | None = None
    event_type: str
    event_date: date | None = None
    guest_count: int | None = None
    budget: Decimal | None = None
    message: str
    status: str
    assigned_to_user_id: str | None = None
    admin_notes: str | None = None
    created_at: datetime
    updated_at: datetime
