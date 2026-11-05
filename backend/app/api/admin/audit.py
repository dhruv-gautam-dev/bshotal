from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_owner
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogOut
from app.schemas.common import PaginatedResponse
from app.utils.pagination import paginate_list

router = APIRouter(prefix="/audit", tags=["Admin Audit Logs (Owner)"])


@router.get("", response_model=PaginatedResponse[AuditLogOut])
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    entity_type: str | None = None,
    action: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if action:
        stmt = stmt.where(AuditLog.action == action)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    items = (await db.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()
    return paginate_list(items, total, page, limit)
