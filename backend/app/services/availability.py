from datetime import date, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blocked_date import BlockedDate
from app.models.booking import Booking
from app.models.room import Room
from app.models.room_type import RoomType


class AvailabilityResult:
    """
    Availability result object that unpacks as a 3-tuple (is_available, available_count, room_type)
    for 100% backward compatibility, while exposing `available_dates` and `booked_dates`.
    """

    def __init__(
        self,
        is_available: bool,
        available_count: int,
        room_type: RoomType | None,
        available_dates: list[date] | None = None,
        booked_dates: list[date] | None = None,
    ):
        self.is_available = is_available
        self.available_count = available_count
        self.room_type = room_type
        self.available_dates = available_dates or []
        self.booked_dates = booked_dates or []

    def __iter__(self):
        yield self.is_available
        yield self.available_count
        yield self.room_type

    def __getitem__(self, idx):
        return (self.is_available, self.available_count, self.room_type)[idx]


def format_date_ranges(dates: list[date]) -> str:
    """
    Format a list of dates into readable human-friendly text.
    Consecutive dates of 3+ are collapsed into 'X Month to Y Month',
    2 dates into 'X Month, Y Month', and single dates into 'X Month'.
    Example:
    [2026-11-11, 2026-11-12] -> '11 Nov, 12 Nov'
    [2026-11-06 .. 2026-11-10] -> '6 Nov to 10 Nov'
    """
    if not dates:
        return ""

    def fmt(d: date) -> str:
        return f"{d.day} {d.strftime('%b')}"

    sorted_dates = sorted(dates)
    ranges: list[str] = []
    range_start = sorted_dates[0]
    prev = sorted_dates[0]
    count = 1

    for d in sorted_dates[1:]:
        if d == prev + timedelta(days=1):
            prev = d
            count += 1
        else:
            if count == 1:
                ranges.append(fmt(range_start))
            elif count == 2:
                ranges.append(f"{fmt(range_start)}, {fmt(prev)}")
            else:
                ranges.append(f"{fmt(range_start)} to {fmt(prev)}")
            range_start = d
            prev = d
            count = 1

    if count == 1:
        ranges.append(fmt(range_start))
    elif count == 2:
        ranges.append(f"{fmt(range_start)}, {fmt(prev)}")
    else:
        ranges.append(f"{fmt(range_start)} to {fmt(prev)}")

    return ", ".join(ranges)


async def check_room_availability(
    db: AsyncSession,
    room_type_id: str,
    check_in: date,
    check_out: date,
    requested_rooms: int = 1,
    for_update: bool = False,
    exclude_booking_id: str | None = None,
) -> AvailabilityResult:
    """
    Checks if `requested_rooms` of `room_type_id` are available between `check_in` and `check_out`.
    Analyzes inventory night-by-night across the entire requested stay.
    If `for_update=True`, locks the room_type row to serialize concurrent booking attempts.
    Returns: AvailabilityResult (supports 3-tuple unpacking: is_available, available_count, room_type)
    """
    if check_out <= check_in:
        return AvailabilityResult(False, 0, None, [], [])

    # 1. Fetch RoomType (with row lock if requested)
    stmt = select(RoomType).where(
        RoomType.id == room_type_id, RoomType.is_active == True, RoomType.is_deleted == False
    )
    if for_update and db.bind and db.bind.dialect.name == "postgresql":
        stmt = stmt.with_for_update()

    result = await db.execute(stmt)
    room_type = result.scalar_one_or_none()
    if not room_type:
        return AvailabilityResult(False, 0, None, [], [])

    # 2. Check blocked dates for this room type or property-wide
    block_stmt = select(BlockedDate).where(
        BlockedDate.is_deleted == False,
        or_(BlockedDate.room_type_id == room_type_id, BlockedDate.room_type_id.is_(None)),
        BlockedDate.start_date < check_out,
        BlockedDate.end_date > check_in,
    )
    block_result = await db.execute(block_stmt)
    blocked_records = block_result.scalars().all()

    # 3. Count total active physical rooms of this room type
    rooms_count_stmt = select(func.count(Room.id)).where(
        Room.room_type_id == room_type_id,
        Room.is_active == True,
        Room.is_deleted == False,
        Room.status != "maintenance",
    )
    physical_rooms_count = (await db.execute(rooms_count_stmt)).scalar() or 0
    total_physical_rooms = max(physical_rooms_count, room_type.total_inventory or 1)

    # 4. Fetch overlapping active bookings (confirmed and checked_in hold inventory)
    booking_stmt = select(Booking).where(
        Booking.room_type_id == room_type_id,
        Booking.is_deleted == False,
        Booking.booking_status.in_(["confirmed", "checked_in"]),
        Booking.check_in_date < check_out,
        Booking.check_out_date > check_in,
    )
    if exclude_booking_id:
        booking_stmt = booking_stmt.where(Booking.id != exclude_booking_id)

    active_bookings = (await db.execute(booking_stmt)).scalars().all()

    # 5. Night-by-night availability check
    total_nights = (check_out - check_in).days
    available_dates: list[date] = []
    booked_dates: list[date] = []
    daily_avail: list[int] = []

    for i in range(total_nights):
        curr_night = check_in + timedelta(days=i)

        # Check if this specific night is covered by a block
        is_blocked = any(
            b.start_date <= curr_night < b.end_date for b in blocked_records
        )
        if is_blocked:
            avail_on_night = 0
        else:
            # Count how many rooms are booked on this specific night
            booked_on_night = sum(
                b.num_rooms
                for b in active_bookings
                if b.check_in_date <= curr_night < b.check_out_date
            )
            avail_on_night = max(0, total_physical_rooms - booked_on_night)

        daily_avail.append(avail_on_night)
        if avail_on_night >= requested_rooms:
            available_dates.append(curr_night)
        else:
            booked_dates.append(curr_night)

    min_available_count = min(daily_avail) if daily_avail else 0
    is_available = len(booked_dates) == 0 and len(available_dates) == total_nights

    return AvailabilityResult(
        is_available=is_available,
        available_count=max(0, min_available_count),
        room_type=room_type,
        available_dates=available_dates,
        booked_dates=booked_dates,
    )
