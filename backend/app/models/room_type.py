from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TimeStampedModel


class RoomType(TimeStampedModel):
    __tablename__ = "room_types"
    __table_args__ = (
        CheckConstraint("base_price >= 0", name="ck_room_types_base_price_positive"),
        CheckConstraint("max_guests > 0", name="ck_room_types_max_guests_positive"),
        CheckConstraint("total_inventory > 0", name="ck_room_types_total_inventory_positive"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    max_guests: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    bed_type: Mapped[str] = mapped_column(String(50), default="King Bed")
    size_sqft: Mapped[int | None] = mapped_column(Integer, nullable=True)
    amenities: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    images: Mapped[list[str] | None] = mapped_column(JSON, default=list)
    total_inventory: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    @property
    def total_rooms(self) -> int:
        return self.total_inventory

    @total_rooms.setter
    def total_rooms(self, value: int) -> None:
        self.total_inventory = int(value) if value is not None else 1

    rooms = relationship("Room", back_populates="room_type", cascade="all, delete-orphan")
    pricing_rules = relationship(
        "PricingRule", back_populates="room_type", cascade="all, delete-orphan"
    )
    blocked_dates = relationship(
        "BlockedDate", back_populates="room_type", cascade="all, delete-orphan"
    )
    bookings = relationship("Booking", back_populates="room_type")
