from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TimeStampedModel


class Room(TimeStampedModel):
    __tablename__ = "rooms"

    room_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    room_type_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("room_types.id", ondelete="CASCADE"), nullable=False, index=True
    )
    floor: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(
        String(20), default="available", nullable=False, index=True
    )  # available, occupied, cleaning, maintenance
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    room_type = relationship("RoomType", back_populates="rooms")
    bookings = relationship("Booking", back_populates="assigned_room")
