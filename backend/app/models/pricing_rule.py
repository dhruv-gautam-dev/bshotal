from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.sqlite import JSON as SQLITE_JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TimeStampedModel


class PricingRule(TimeStampedModel):
    __tablename__ = "pricing_rules"

    room_type_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("room_types.id", ondelete="CASCADE"), nullable=True, index=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    rule_type: Mapped[str] = mapped_column(
        String(30), default="override_price", nullable=False
    )  # override_price, percentage_adjustment, fixed_adjustment
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    days_of_week: Mapped[list[int] | None] = mapped_column(
        SQLITE_JSON, default=list
    )  # e.g. [5, 6] for weekend
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    room_type = relationship("RoomType", back_populates="pricing_rules")
