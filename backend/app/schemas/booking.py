from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import EmailStr, Field, field_validator, model_validator

from app.schemas.common import BaseSchema
from app.schemas.payment import PaymentOut


class BookingHistoryOut(BaseSchema):
    id: str
    from_status: str
    to_status: str
    changed_by_user_id: str | None = None
    notes: str | None = None
    created_at: datetime


class BookingCreatePublic(BaseSchema):
    room_type_id: str
    guest_name: str = Field(..., min_length=2, max_length=100)
    guest_phone: str = Field(..., pattern=r"^(\+?[1-9]\d{6,14}|[6-9]\d{9})$")
    guest_email: EmailStr | None = None
    check_in_date: date
    check_out_date: date
    num_rooms: int = Field(1, ge=1, le=10)
    num_guests: int = Field(1, ge=1, le=30)
    num_children: int = Field(0, ge=0, le=10)
    special_requests: str | None = None
    honeypot: str | None = None  # Anti-spam field: must be empty

    @field_validator("check_out_date")
    @classmethod
    def validate_dates(cls, v: date, info):
        check_in = info.data.get("check_in_date")
        if check_in and v <= check_in:
            raise ValueError("check_out_date must be strictly after check_in_date")
        return v


class BookingCreateAdmin(BaseSchema):
    room_type_id: str
    assigned_room_id: str | None = None
    guest_name: str
    guest_phone: str
    guest_email: EmailStr | None = None
    check_in_date: date
    check_out_date: date
    num_rooms: int = 1
    num_guests: int = 1
    num_children: int = 0
    base_amount: Decimal
    tax_amount: Decimal = Decimal("0.00")
    total_amount: Decimal
    advance_paid: Decimal = Decimal("0.00")
    payment_status: str = "unpaid"
    booking_status: str = "confirmed"
    source: str = "walkin"
    special_requests: str | None = None
    admin_notes: str | None = None
    id_proof_type: str | None = None
    id_proof_number: str | None = None

    @field_validator("check_out_date")
    @classmethod
    def validate_dates(cls, v: date, info):
        check_in = info.data.get("check_in_date")
        if check_in and v <= check_in:
            raise ValueError("Check-out date must be strictly after check-in date")
        return v


class BookingUpdateAdmin(BaseSchema):
    assigned_room_id: str | None = None
    guest_name: str | None = None
    guest_phone: str | None = None
    guest_email: EmailStr | None = None
    num_rooms: int | None = None
    num_guests: int | None = None
    num_children: int | None = None
    check_in_date: date | None = None
    check_out_date: date | None = None
    base_amount: Decimal | None = None
    tax_amount: Decimal | None = None
    total_amount: Decimal | None = None
    advance_paid: Decimal | None = None
    payment_status: str | None = None
    booking_status: str | None = None
    special_requests: str | None = None
    admin_notes: str | None = None
    id_proof_type: str | None = None
    id_proof_number: str | None = None


class BookingStatusUpdate(BaseSchema):
    status: str = Field(
        ..., pattern="^(pending|confirmed|checked_in|checked_out|cancelled|no_show|failed)$"
    )
    assigned_room_id: str | None = None
    cancellation_reason: str | None = None
    admin_notes: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_status_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Accept booking_status as an alias for status
            if "status" not in data and "booking_status" in data:
                data["status"] = data["booking_status"]
            # Accept room_id or room as aliases for assigned_room_id
            if "assigned_room_id" not in data:
                if "room_id" in data:
                    data["assigned_room_id"] = data["room_id"]
                elif "room" in data and isinstance(data["room"], str):
                    data["assigned_room_id"] = data["room"]
            # Accept cancel_reason or reason as aliases for cancellation_reason
            if not data.get("cancellation_reason"):
                data["cancellation_reason"] = data.get("cancel_reason") or data.get("reason")
            # Default cancellation reason if cancelling
            if data.get("status") == "cancelled" and not data.get("cancellation_reason"):
                data["cancellation_reason"] = "Cancelled by staff/guest request"
        return data


class BookingOut(BaseSchema):
    id: str
    booking_reference: str
    room_type_id: str
    assigned_room_id: str | None = None
    room_number: str | None = None
    customer_id: str | None = None
    guest_name: str
    guest_phone: str
    guest_email: str | None = None
    check_in_date: date
    check_out_date: date
    num_rooms: int
    num_guests: int
    num_children: int
    base_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    advance_paid: Decimal
    payment_status: str
    booking_status: str
    cancellation_reason: str | None = None
    source: str
    special_requests: str | None = None
    admin_notes: str | None = None
    id_proof_type: str | None = None
    id_proof_number: str | None = None
    created_at: datetime
    updated_at: datetime
    history: list[BookingHistoryOut] = Field(default_factory=list)
    payments: list[PaymentOut] = Field(default_factory=list)


class BookingPublicResponse(BaseSchema):
    booking_reference: str
    guest_name: str
    check_in_date: date
    check_out_date: date
    total_amount: Decimal
    booking_status: str
    whatsapp_url: str
    message: str
