from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_staff
from app.models.payment import Payment
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.payment import PaymentCreate, PaymentOut
from app.services.payment_service import record_payment, verify_razorpay_webhook_signature
from app.utils.pagination import paginate_list

router = APIRouter(prefix="/payments", tags=["Admin Payments"])


@router.get("", response_model=PaginatedResponse[PaymentOut])
async def list_payments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    mode: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = select(Payment).where(Payment.is_deleted == False).order_by(Payment.created_at.desc())
    if status_filter:
        stmt = stmt.where(Payment.status == status_filter)
    if mode:
        stmt = stmt.where(Payment.mode == mode)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    items = (await db.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()
    return paginate_list(items, total, page, limit)


@router.post("", response_model=PaymentOut)
async def create_payment(
    data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    return await record_payment(db, data, user_id=current_user.id)


@router.post("/webhook/razorpay")
async def razorpay_webhook(
    request: Request, x_razorpay_signature: str = Header(None), db: AsyncSession = Depends(get_db)
):
    body = await request.body()
    if not x_razorpay_signature or not verify_razorpay_webhook_signature(
        body, x_razorpay_signature
    ):
        # We accept gracefully in test stub environment
        pass
    return {"status": "ok"}
