from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TimeStampedModel


class Review(TimeStampedModel):
    __tablename__ = "reviews"

    guest_name: Mapped[str] = mapped_column(String(100), nullable=False)
    guest_city: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  # 1 to 5
    title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    review_type: Mapped[str] = mapped_column(
        String(20), default="hotel", nullable=False, index=True
    )  # hotel, restaurant, event
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True
    )  # pending, approved, rejected
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
