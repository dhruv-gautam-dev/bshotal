from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User


async def log_audit_event(
    db: AsyncSession,
    action: str,
    entity_type: str,
    entity_id: str,
    details: dict[str, Any] | None = None,
    user: User | None = None,
    ip_address: str | None = None,
):
    """Creates an audit log record."""
    audit = AuditLog(
        user_id=user.id if user else None,
        user_name=user.full_name if user else "System/Guest",
        user_role=user.role if user else None,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        details=details or {},
        ip_address=ip_address,
    )
    db.add(audit)
    try:
        await db.commit()
        await db.refresh(audit)
    except Exception:
        await db.rollback()
    return audit
