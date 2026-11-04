from datetime import datetime

from pydantic import Field

from app.schemas.common import BaseSchema


class ReviewCreatePublic(BaseSchema):
    guest_name: str = Field(..., min_length=2, max_length=100)
    guest_city: str | None = None
    rating: int = Field(..., ge=1, le=5)
    title: str | None = None
    comment: str = Field(..., min_length=5)
    review_type: str = Field("hotel", pattern="^(hotel|restaurant|event)$")
    honeypot: str | None = None


class ReviewStatusUpdate(BaseSchema):
    status: str = Field(..., pattern="^(pending|approved|rejected)$")
    is_featured: bool | None = None


class ReviewOut(BaseSchema):
    id: str
    guest_name: str
    guest_city: str | None = None
    rating: int
    title: str | None = None
    comment: str
    review_type: str
    status: str
    is_featured: bool
    created_at: datetime


class ReviewSummary(BaseSchema):
    average_rating: float
    total_reviews: int
    rating_breakdown: dict[int, int]
