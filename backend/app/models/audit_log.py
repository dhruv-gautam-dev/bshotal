from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.sqlite import JSON as SQLITE_JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TimeStampedModel


class AuditLog(TimeStampedModel):
    __tablename__ = "audit_logs"

    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True, index=True
    )
    user_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    user_role: Mapped[str | None] = mapped_column(String(20), nullable=True)

    action: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # create, update, delete, status_change
    entity_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # booking, order, room, etc.
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    details: Mapped[dict[str, Any] | None] = mapped_column(SQLITE_JSON, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
