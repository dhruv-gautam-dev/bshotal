from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TimeStampedModel


class BlockedDate(TimeStampedModel):
    __tablename__ = "blocked_dates"

    room_type_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("room_types.id", ondelete="CASCADE"), nullable=True, index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    room_type = relationship("RoomType", back_populates="blocked_dates")
