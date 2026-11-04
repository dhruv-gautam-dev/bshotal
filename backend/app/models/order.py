from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TimeStampedModel


class Order(TimeStampedModel):
    __tablename__ = "orders"

    order_reference: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )

    customer_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("customers.id"), nullable=True, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    customer_email: Mapped[str | None] = mapped_column(String(100), nullable=True)

    order_type: Mapped[str] = mapped_column(
        String(20), default="dine-in", nullable=False, index=True
    )  # dine-in, pickup, delivery
    table_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    delivery_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    status: Mapped[str] = mapped_column(
        String(25), default="new", nullable=False, index=True
    )  # new, accepted, preparing, ready, out_for_delivery, served, completed, cancelled
    payment_status: Mapped[str] = mapped_column(
        String(20), default="unpaid", nullable=False, index=True
    )  # unpaid, paid, refunded
    payment_mode: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # cash, upi, card, online

    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    kitchen_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_prep_minutes: Mapped[int] = mapped_column(Integer, default=25)

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")


class OrderItem(TimeStampedModel):
    __tablename__ = "order_items"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    menu_item_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("menu_items.id"), nullable=False
    )
    item_name: Mapped[str] = mapped_column(String(150), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem", back_populates="order_items")
