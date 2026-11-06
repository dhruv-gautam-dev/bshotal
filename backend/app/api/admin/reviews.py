from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_manager, require_staff
from app.models.review import Review
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.review import ReviewOut, ReviewStatusUpdate
from app.services.notification_service import broadcaster
from app.utils.pagination import paginate_list

router = APIRouter(prefix="/reviews", tags=["Admin Reviews Moderation"])


@router.get("", response_model=PaginatedResponse[ReviewOut])
async def list_admin_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = select(Review).where(Review.is_deleted == False).order_by(Review.created_at.desc())
    if status_filter:
        stmt = stmt.where(Review.status == status_filter)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    items = (await db.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()
    return paginate_list(items, total, page, limit)


@router.patch("/{review_id}", response_model=ReviewOut)
async def moderate_review(
    review_id: str,
    data: ReviewStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    review = await db.get(Review, review_id)
    if not review or review.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    review.status = data.status
    if data.is_featured is not None:
        review.is_featured = data.is_featured
    review.approved_by_user_id = current_user.id

    await db.commit()
    await db.refresh(review)
    await broadcaster.broadcast("review_updated", {"action": "moderate", "id": review.id, "status": data.status})
    return review


@router.delete("/{review_id}", response_model=MessageResponse)
async def delete_review(
    review_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")
    review.is_deleted = True
    await db.commit()
    await broadcaster.broadcast("review_updated", {"action": "delete", "id": review_id})
    return MessageResponse(message="Review deleted")
