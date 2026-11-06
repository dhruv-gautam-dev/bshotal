import asyncio

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_staff
from app.models.notification import Notification
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services.notification_service import broadcaster
from app.utils.pagination import paginate_list

router = APIRouter(prefix="/notifications", tags=["Admin Notifications & Live Stream"])


@router.get("", response_model=PaginatedResponse[dict])
async def list_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = select(Notification).order_by(Notification.created_at.desc())
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    records = (await db.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()
    items = [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "category": n.category,
            "reference_id": n.reference_id,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        }
        for n in records
    ]
    return paginate_list(items, total, page, limit)


@router.patch("/{notification_id}/read", response_model=MessageResponse)
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    notif = await db.get(Notification, notification_id)
    if notif:
        notif.is_read = True
        await db.commit()
    return MessageResponse(message="Notification marked read")


@router.get("/stream")
async def sse_notifications_stream(request: Request, current_user: User = Depends(require_staff)):
    """
    Server-Sent Events (SSE) live stream for kitchen board and live notifications.
    """
    queue = await broadcaster.subscribe()

    async def event_generator():
        try:
            # Send initial ping
            yield 'event: connected\ndata: {"status": "ok"}\n\n'
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield data
                except (TimeoutError, asyncio.TimeoutError):
                    # Keep-alive heartbeat
                    yield ": ping\n\n"
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
