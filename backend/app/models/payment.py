from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TimeStampedModel


class Payment(TimeStampedModel):
    __tablename__ = "payments"

    payment_reference: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )

    booking_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=True, index=True
    )
    order_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=True, index=True
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    mode: Mapped[str] = mapped_column(
        String(20), default="cash", nullable=False
    )  # cash, upi, card, online
    status: Mapped[str] = mapped_column(
        String(20), default="completed", nullable=False, index=True
    )  # pending, completed, failed, refunded
    payment_type: Mapped[str] = mapped_column(
        String(20), default="full", nullable=False
    )  # advance, settlement, full, refund

    transaction_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gateway_order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gateway_payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )

    booking = relationship("Booking", back_populates="payments")
    order = relationship("Order", back_populates="payments")
