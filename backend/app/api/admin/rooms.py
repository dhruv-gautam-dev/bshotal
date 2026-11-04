from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_manager, require_staff
from app.models.blocked_date import BlockedDate
from app.models.pricing_rule import PricingRule
from app.models.room import Room
from app.models.room_type import RoomType
from app.models.user import User
from app.schemas.blocked_date import BlockedDateCreate, BlockedDateOut
from app.schemas.common import MessageResponse
from app.schemas.pricing_rule import PricingRuleCreate, PricingRuleOut
from app.schemas.room import RoomCreate, RoomOut, RoomUpdate
from app.schemas.room_type import RoomTypeCreate, RoomTypeOut, RoomTypeUpdate
from app.services.availability import check_room_availability

router = APIRouter(prefix="/rooms", tags=["Admin Rooms & Inventory"])


# --- Room Types CRUD ---
@router.get("/types", response_model=list[RoomTypeOut])
async def list_room_types(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    stmt = (
        select(RoomType).where(RoomType.is_deleted == False).order_by(RoomType.display_order.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/types", response_model=RoomTypeOut)
async def create_room_type(
    data: RoomTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    rt = RoomType(**data.model_dump())
    db.add(rt)
    await db.commit()
    await db.refresh(rt)
    return rt


@router.put("/types/{room_type_id}", response_model=RoomTypeOut)
async def update_room_type(
    room_type_id: str,
    data: RoomTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    rt = await db.get(RoomType, room_type_id)
    if not rt or rt.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room type not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(rt, k, v)
    await db.commit()
    await db.refresh(rt)
    return rt


@router.delete("/types/{room_type_id}", response_model=MessageResponse)
async def delete_room_type(
    room_type_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    rt = await db.get(RoomType, room_type_id)
    if not rt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room type not found")
    rt.is_deleted = True
    await db.commit()
    return MessageResponse(message="Room type deleted")


# --- Physical Rooms CRUD ---
@router.get("/inventory", response_model=list[RoomOut])
async def list_rooms(
    room_type_id: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = select(Room).where(Room.is_deleted == False).order_by(Room.room_number.asc())
    if room_type_id:
        stmt = stmt.where(Room.room_type_id == room_type_id)
    if status_filter:
        stmt = stmt.where(Room.status == status_filter)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/inventory", response_model=RoomOut)
async def create_room(
    data: RoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    # Check duplicate room number
    exist = await db.execute(
        select(Room).where(Room.room_number == data.room_number, Room.is_deleted == False)
    )
    if exist.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Room number already exists"
        )
    room = Room(**data.model_dump())
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return room


@router.put("/inventory/{room_id}", response_model=RoomOut)
async def update_room(
    room_id: str,
    data: RoomUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),  # Staff can update cleaning status
):
    room = await db.get(Room, room_id)
    if not room or room.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    # If not manager, staff can ONLY toggle status
    if current_user.role == "staff":
        if data.status:
            room.status = data.status
    else:
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(room, k, v)

    await db.commit()
    await db.refresh(room)
    return room


# --- Blocked Dates CRUD ---
@router.get("/blocked-dates", response_model=list[BlockedDateOut])
async def list_blocked_dates(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    stmt = (
        select(BlockedDate)
        .where(BlockedDate.is_deleted == False)
        .order_by(BlockedDate.start_date.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/blocked-dates", response_model=BlockedDateOut)
async def create_blocked_date(
    data: BlockedDateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    block = BlockedDate(**data.model_dump())
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return block


@router.delete("/blocked-dates/{block_id}", response_model=MessageResponse)
async def delete_blocked_date(
    block_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_manager)
):
    block = await db.get(BlockedDate, block_id)
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Blocked date record not found"
        )
    block.is_deleted = True
    await db.commit()
    return MessageResponse(message="Blocked date removed")


# --- Pricing Rules CRUD ---
@router.get("/pricing-rules", response_model=list[PricingRuleOut])
async def list_pricing_rules(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    stmt = (
        select(PricingRule)
        .where(PricingRule.is_deleted == False)
        .order_by(PricingRule.start_date.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/pricing-rules", response_model=PricingRuleOut)
async def create_pricing_rule(
    data: PricingRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    rule = PricingRule(**data.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/pricing-rules/{rule_id}", response_model=MessageResponse)
async def delete_pricing_rule(
    rule_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_manager)
):
    rule = await db.get(PricingRule, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found")
    rule.is_deleted = True
    await db.commit()
    return MessageResponse(message="Pricing rule deleted")


# --- Month Availability Calendar ---
@router.get("/calendar")
async def get_availability_calendar(
    year: int = Query(..., ge=2024, le=2030),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)

    room_types = (
        (await db.execute(select(RoomType).where(RoomType.is_deleted == False))).scalars().all()
    )
    calendar_data = []

    curr = start
    while curr <= end:
        day_info = {"date": curr.isoformat(), "room_types": {}}
        for rt in room_types:
            is_avail, avail_count, _ = await check_room_availability(
                db, rt.id, check_in=curr, check_out=curr + timedelta(days=1), requested_rooms=1
            )
            day_info["room_types"][rt.id] = {
                "name": rt.name,
                "available_rooms": avail_count,
                "is_available": is_avail,
            }
        calendar_data.append(day_info)
        curr += timedelta(days=1)

    return calendar_data
