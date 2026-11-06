from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_owner, require_staff
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogCreate, AuditLogOut
from app.schemas.common import PaginatedResponse
from app.services.audit_service import log_audit_event
from app.utils.pagination import paginate_list

router = APIRouter(prefix="/audit", tags=["Admin Audit Logs (Owner)"])


@router.get("", response_model=PaginatedResponse[AuditLogOut])
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    entity_type: str | None = None,
    action: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                AuditLog.user_name.ilike(term),
                AuditLog.user_role.ilike(term),
                AuditLog.action.ilike(term),
                AuditLog.entity_type.ilike(term),
                AuditLog.entity_id.ilike(term),
            )
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    items = (await db.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()
    return paginate_list(items, total, page, limit)


@router.post("", response_model=AuditLogOut)
async def create_audit_log(
    data: AuditLogCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    details = data.details or {}
    if data.summary and "summary" not in details:
        details["summary"] = data.summary

    client_ip = request.client.host if request.client else None
    audit = await log_audit_event(
        db=db,
        action=data.action,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        details=details,
        user=current_user,
        ip_address=client_ip,
    )
    return audit
