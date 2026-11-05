from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TimeStampedModel


class Customer(TimeStampedModel):
    __tablename__ = "customers"
    __table_args__ = (
        CheckConstraint("total_spent >= 0", name="ck_customers_total_spent_positive"),
        CheckConstraint("total_bookings_count >= 0", name="ck_customers_bookings_count_positive"),
        CheckConstraint("total_orders_count >= 0", name="ck_customers_orders_count_positive"),
    )

    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(100), unique=True, index=True, nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    total_bookings_count: Mapped[int] = mapped_column(Integer, default=0)
    total_orders_count: Mapped[int] = mapped_column(Integer, default=0)
    total_spent: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    bookings = relationship("Booking", back_populates="customer")
    orders = relationship("Order", back_populates="customer")
