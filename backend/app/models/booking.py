from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TimeStampedModel


class Booking(TimeStampedModel):
    __tablename__ = "bookings"

    booking_reference: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )

    room_type_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("room_types.id"), nullable=False, index=True
    )
    assigned_room_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("rooms.id"), nullable=True, index=True
    )
    customer_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("customers.id"), nullable=True, index=True
    )

    guest_name: Mapped[str] = mapped_column(String(100), nullable=False)
    guest_phone: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    guest_email: Mapped[str | None] = mapped_column(String(100), nullable=True)

    check_in_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    check_out_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    num_rooms: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    num_guests: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    num_children: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    base_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    advance_paid: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )

    payment_status: Mapped[str] = mapped_column(
        String(20), default="unpaid", nullable=False, index=True
    )  # unpaid, partial, paid, refunded
    booking_status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True
    )  # pending, confirmed, checked_in, checked_out, cancelled, no_show
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(
        String(20), default="website", nullable=False
    )  # website, phone, walkin, whatsapp

    special_requests: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    id_proof_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    id_proof_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    room_type = relationship("RoomType", back_populates="bookings")
    assigned_room = relationship("Room", back_populates="bookings")
    customer = relationship("Customer", back_populates="bookings")
    payments = relationship("Payment", back_populates="booking", cascade="all, delete-orphan")
    history = relationship(
        "BookingHistory",
        back_populates="booking",
        cascade="all, delete-orphan",
        order_by="BookingHistory.created_at",
    )


class BookingHistory(TimeStampedModel):
    __tablename__ = "booking_history"

    booking_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str] = mapped_column(String(20), nullable=False)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    changed_by_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    booking = relationship("Booking", back_populates="history")
