from datetime import datetime
from decimal import Decimal

from pydantic import EmailStr, Field

from app.schemas.common import BaseSchema
from app.schemas.payment import PaymentOut


class OrderItemInput(BaseSchema):
    menu_item_id: str
    quantity: int = Field(..., ge=1, le=50)
    special_instructions: str | None = None


class OrderItemOut(BaseSchema):
    id: str
    menu_item_id: str
    item_name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    special_instructions: str | None = None


class OrderCreatePublic(BaseSchema):
    customer_name: str = Field(..., min_length=2, max_length=100)
    customer_phone: str = Field(..., pattern=r"^(\+91[\-\s]?)?[6-9]\d{9}$")
    customer_email: EmailStr | None = None
    order_type: str = Field("dine-in", pattern="^(dine-in|pickup|delivery)$")
    table_number: str | None = None
    delivery_address: str | None = None
    items: list[OrderItemInput] = Field(..., min_length=1)
    kitchen_notes: str | None = None
    honeypot: str | None = None  # Anti-spam


class OrderCreateAdmin(BaseSchema):
    customer_name: str
    customer_phone: str
    customer_email: EmailStr | None = None
    order_type: str = "dine-in"
    table_number: str | None = None
    delivery_address: str | None = None
    items: list[OrderItemInput] = Field(..., min_length=1)
    status: str = "accepted"
    payment_status: str = "unpaid"
    payment_mode: str | None = None
    kitchen_notes: str | None = None


class OrderStatusUpdate(BaseSchema):
    status: str = Field(
        ..., pattern="^(new|accepted|preparing|ready|out_for_delivery|served|completed|cancelled)$"
    )
    cancellation_reason: str | None = None
    payment_status: str | None = Field(None, pattern="^(unpaid|paid|refunded)$")
    payment_mode: str | None = Field(None, pattern="^(cash|upi|card|online)$")


class OrderOut(BaseSchema):
    id: str
    order_reference: str
    customer_id: str | None = None
    customer_name: str
    customer_phone: str
    customer_email: str | None = None
    order_type: str
    table_number: str | None = None
    delivery_address: str | None = None
    subtotal: Decimal
    tax_amount: Decimal
    delivery_fee: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    status: str
    payment_status: str
    payment_mode: str | None = None
    cancellation_reason: str | None = None
    kitchen_notes: str | None = None
    estimated_prep_minutes: int
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut] = Field(default_factory=list)
    payments: list[PaymentOut] = Field(default_factory=list)


class OrderPublicStatus(BaseSchema):
    order_reference: str
    customer_name: str
    order_type: str
    status: str
    payment_status: str
    total_amount: Decimal
    estimated_prep_minutes: int
    created_at: datetime
    items_count: int
