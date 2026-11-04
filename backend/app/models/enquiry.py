from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TimeStampedModel


class Enquiry(TimeStampedModel):
    __tablename__ = "enquiries"

    enquiry_reference: Mapped[str] = mapped_column(
        String(30), unique=True, index=True, nullable=False
    )

    customer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    customer_email: Mapped[str | None] = mapped_column(String(100), nullable=True)

    event_type: Mapped[str] = mapped_column(
        String(30), default="custom", nullable=False, index=True
    )  # ring, birthday, wedding, custom, contact
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    guest_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    budget: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20), default="new", nullable=False, index=True
    )  # new, contacted, quote_sent, confirmed, lost
    assigned_to_user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
