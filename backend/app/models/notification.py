from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TimeStampedModel


class Notification(TimeStampedModel):
    __tablename__ = "notifications"

    title: Mapped[str] = mapped_column(String(150), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(30), default="system", nullable=False, index=True
    )  # booking, order, enquiry, review, system
    reference_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    for_role: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # owner, manager, staff, or None
