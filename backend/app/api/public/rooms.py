from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.room_type import RoomType
from app.schemas.room_type import RoomTypeOut, RoomTypeQuote
from app.services.availability import check_room_availability
from app.services.pricing import calculate_room_pricing

router = APIRouter(prefix="/rooms", tags=["Public Rooms"])


@router.get("", response_model=list[RoomTypeOut])
async def get_public_room_types(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(RoomType)
        .where(RoomType.is_active == True, RoomType.is_deleted == False)
        .order_by(RoomType.display_order.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/availability", response_model=list[RoomTypeQuote])
async def check_public_availability(
    check_in: date = Query(..., description="Check-in date (YYYY-MM-DD)"),
    check_out: date = Query(..., description="Check-out date (YYYY-MM-DD)"),
    guests: int = Query(1, ge=1, le=30),
    rooms: int = Query(1, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    if check_out <= check_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="check_out must be strictly after check_in",
        )

    stmt = (
        select(RoomType)
        .where(RoomType.is_active == True, RoomType.is_deleted == False)
        .order_by(RoomType.display_order.asc())
    )
    res = await db.execute(stmt)
    room_types = res.scalars().all()

    quotes: list[RoomTypeQuote] = []
    nights = (check_out - check_in).days

    for rt in room_types:
        is_avail, avail_count, _ = await check_room_availability(
            db,
            room_type_id=rt.id,
            check_in=check_in,
            check_out=check_out,
            requested_rooms=rooms,
            for_update=False,
        )

        daily_rates, base_amount, tax_pct, tax_amt, total_amt = await calculate_room_pricing(
            db, rt, check_in, check_out, num_rooms=rooms
        )

        quotes.append(
            RoomTypeQuote(
                room_type_id=rt.id,
                name=rt.name,
                slug=rt.slug,
                bed_type=rt.bed_type,
                max_guests=rt.max_guests,
                images=rt.images or [],
                amenities=rt.amenities or [],
                available_rooms=avail_count,
                is_available=is_avail,
                nights=nights,
                daily_rates=daily_rates,
                base_amount=base_amount,
                tax_percent=tax_pct,
                tax_amount=tax_amt,
                total_amount=total_amt,
            )
        )

    return quotes
