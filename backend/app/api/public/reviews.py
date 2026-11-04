from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.review import Review
from app.schemas.common import MessageResponse
from app.schemas.review import ReviewCreatePublic, ReviewOut, ReviewSummary
from app.services.notification_service import create_notification

router = APIRouter(prefix="/reviews", tags=["Public Reviews"])


@router.get("", response_model=list[ReviewOut])
async def get_public_reviews(review_type: str = "hotel", db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Review)
        .where(
            Review.status == "approved",
            Review.is_deleted == False,
            Review.review_type == review_type,
        )
        .order_by(Review.is_featured.desc(), Review.created_at.desc())
        .limit(50)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/summary", response_model=ReviewSummary)
async def get_reviews_summary(review_type: str = "hotel", db: AsyncSession = Depends(get_db)):
    stmt = select(Review.rating).where(
        Review.status == "approved", Review.is_deleted == False, Review.review_type == review_type
    )
    res = await db.execute(stmt)
    ratings = res.scalars().all()

    if not ratings:
        return ReviewSummary(
            average_rating=5.0, total_reviews=0, rating_breakdown={5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        )

    avg = round(sum(ratings) / len(ratings), 1)
    counts = Counter(ratings)
    breakdown = {star: counts.get(star, 0) for star in range(1, 6)}

    return ReviewSummary(average_rating=avg, total_reviews=len(ratings), rating_breakdown=breakdown)


@router.post("", response_model=MessageResponse)
async def submit_public_review(review_in: ReviewCreatePublic, db: AsyncSession = Depends(get_db)):
    if review_in.honeypot:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request")

    review = Review(
        guest_name=review_in.guest_name,
        guest_city=review_in.guest_city,
        rating=review_in.rating,
        title=review_in.title,
        comment=review_in.comment,
        review_type=review_in.review_type,
        status="pending",  # Needs admin moderation
    )
    db.add(review)
    await db.commit()

    await create_notification(
        db,
        title="New Guest Review Submitted",
        message=f"{review.guest_name} rated {review.rating} stars: '{review.comment[:60]}...'",
        category="review",
        reference_id=review.id,
    )

    return MessageResponse(
        message="Thank you for sharing your feedback! Your review has been submitted for moderation."
    )
