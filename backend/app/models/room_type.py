from decimal import Decimal

from sqlalchemy import Boolean, Integer, Numeric, String, Text
from sqlalchemy.dialects.sqlite import JSON as SQLITE_JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TimeStampedModel


class RoomType(TimeStampedModel):
    __tablename__ = "room_types"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    max_guests: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    bed_type: Mapped[str] = mapped_column(String(50), default="King Bed")
    size_sqft: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amenities: Mapped[list[str] | None] = mapped_column(SQLITE_JSON, default=list)
    images: Mapped[list[str] | None] = mapped_column(SQLITE_JSON, default=list)
    total_inventory: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    rooms = relationship("Room", back_populates="room_type", cascade="all, delete-orphan")
    pricing_rules = relationship(
        "PricingRule", back_populates="room_type", cascade="all, delete-orphan"
    )
    blocked_dates = relationship(
        "BlockedDate", back_populates="room_type", cascade="all, delete-orphan"
    )
    bookings = relationship("Booking", back_populates="room_type")
