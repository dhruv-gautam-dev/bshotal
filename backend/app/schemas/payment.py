from datetime import datetime
from decimal import Decimal

from pydantic import Field

from app.schemas.common import BaseSchema


class PaymentBase(BaseSchema):
    booking_id: str | None = None
    order_id: str | None = None
    amount: Decimal
    currency: str = "INR"
    mode: str = Field("cash", pattern="^(cash|upi|card|online)$")
    status: str = Field("completed", pattern="^(pending|completed|failed|refunded)$")
    payment_type: str = Field("full", pattern="^(advance|settlement|full|refund)$")
    transaction_id: str | None = None
    gateway_order_id: str | None = None
    gateway_payment_id: str | None = None
    notes: str | None = None


class PaymentCreate(PaymentBase):
    pass


class PaymentOut(PaymentBase):
    id: str
    payment_reference: str
    recorded_by_user_id: str | None = None
    created_at: datetime
