from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blocked_date import BlockedDate
from app.models.booking import Booking
from app.models.room import Room
from app.models.room_type import RoomType


async def check_room_availability(
    db: AsyncSession,
    room_type_id: str,
    check_in: date,
    check_out: date,
    requested_rooms: int = 1,
    for_update: bool = False,
) -> tuple[bool, int, RoomType | None]:
    """
    Checks if `requested_rooms` of `room_type_id` are available between `check_in` and `check_out`.
    If `for_update=True`, locks the room_type row to serialize concurrent booking attempts.
    Returns: (is_available, available_count, room_type)
    """
    # 1. Fetch RoomType (with row lock if requested)
    stmt = select(RoomType).where(
        RoomType.id == room_type_id, RoomType.is_active == True, RoomType.is_deleted == False
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update()

    result = await db.execute(stmt)
    room_type = result.scalar_one_or_none()
    if not room_type:
        return False, 0, None

    # 2. Check if dates are blocked for this room type or property-wide
    block_stmt = select(BlockedDate).where(
        BlockedDate.is_deleted == False,
        or_(BlockedDate.room_type_id == room_type_id, BlockedDate.room_type_id.is_(None)),
        BlockedDate.start_date < check_out,
        BlockedDate.end_date > check_in,
    )
    block_result = await db.execute(block_stmt)
    if block_result.scalars().first():
        return False, 0, room_type

    # 3. Count total active physical rooms of this room type
    rooms_count_stmt = select(func.count(Room.id)).where(
        Room.room_type_id == room_type_id,
        Room.is_active == True,
        Room.is_deleted == False,
        Room.status != "maintenance",
    )
    total_physical_rooms = (
        await db.execute(rooms_count_stmt)
    ).scalar() or room_type.total_inventory

    # 4. Count overlapping active bookings
    # Overlap condition: booking.check_in_date < check_out AND booking.check_out_date > check_in
    overlap_stmt = select(func.coalesce(func.sum(Booking.num_rooms), 0)).where(
        Booking.room_type_id == room_type_id,
        Booking.is_deleted == False,
        Booking.booking_status.not_in(["cancelled", "no_show"]),
        Booking.check_in_date < check_out,
        Booking.check_out_date > check_in,
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        overlap_stmt = overlap_stmt.with_for_update()

    booked_rooms_count = (await db.execute(overlap_stmt)).scalar() or 0
    available_count = max(0, total_physical_rooms - booked_rooms_count)

    is_available = available_count >= requested_rooms
    return is_available, available_count, room_type
