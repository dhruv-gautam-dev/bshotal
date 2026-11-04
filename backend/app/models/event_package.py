from decimal import Decimal

from sqlalchemy import Boolean, Integer, Numeric, String, Text
from sqlalchemy.dialects.sqlite import JSON as SQLITE_JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TimeStampedModel


class EventPackage(TimeStampedModel):
    __tablename__ = "event_packages"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price_per_plate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    min_guests: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    max_guests: Mapped[int] = mapped_column(Integer, default=500, nullable=False)
    features: Mapped[list[str] | None] = mapped_column(SQLITE_JSON, default=list)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
