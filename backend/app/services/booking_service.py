import asyncio
import random
import string
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingHistory
from app.models.customer import Customer
from app.models.room import Room
from app.schemas.booking import BookingCreatePublic, BookingStatusUpdate
from app.services.availability import check_room_availability
from app.services.pricing import calculate_room_pricing

_booking_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

ALLOWED_BOOKING_TRANSITIONS = {
    "pending": {"confirmed", "cancelled"},
    "confirmed": {"checked_in", "cancelled", "no_show", "pending"},
    "checked_in": {"checked_out", "cancelled"},
    "checked_out": set(),
    "cancelled": {"pending", "confirmed"},
    "no_show": {"confirmed", "pending"},
}


def generate_booking_reference() -> str:
    year = datetime.now(UTC).year
    rand_chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"BSH-{year}-{rand_chars}"


async def get_or_create_customer(
    db: AsyncSession, phone: str, name: str, email: str | None = None
) -> Customer:
    """Finds customer by phone or creates a new customer profile."""
    stmt = select(Customer).where(Customer.phone == phone, Customer.is_deleted == False)
    res = await db.execute(stmt)
    customer = res.scalar_one_or_none()
    if not customer:
        customer = Customer(phone=phone, name=name, email=email)
        db.add(customer)
        await db.flush()
    else:
        if name and not customer.name:
            customer.name = name
        if email and not customer.email:
            customer.email = email
    return customer


async def create_public_booking(db: AsyncSession, data: BookingCreatePublic) -> Booking:
    """
    Public booking creation with concurrency lock and server-side price calculation.
    """
    if data.honeypot:
        # Bot detected
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request")

    async with _booking_locks[data.room_type_id]:
        # Concurrency check with row lock
        is_avail, avail_count, room_type = await check_room_availability(
            db,
            room_type_id=data.room_type_id,
            check_in=data.check_in_date,
            check_out=data.check_out_date,
            requested_rooms=data.num_rooms,
            for_update=True,
        )
        if not is_avail or not room_type:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Selected room type is not available for the chosen dates. Please choose different dates or room type.",
            )

        # Server-side pricing calculation
        _, base_amount, _, tax_amount, total_amount = await calculate_room_pricing(
            db, room_type, data.check_in_date, data.check_out_date, data.num_rooms
        )

        customer = await get_or_create_customer(
            db, phone=data.guest_phone, name=data.guest_name, email=data.guest_email
        )

        booking = Booking(
            booking_reference=generate_booking_reference(),
            room_type_id=data.room_type_id,
            customer_id=customer.id,
            guest_name=data.guest_name,
            guest_phone=data.guest_phone,
            guest_email=data.guest_email,
            check_in_date=data.check_in_date,
            check_out_date=data.check_out_date,
            num_rooms=data.num_rooms,
            num_guests=data.num_guests,
            num_children=data.num_children,
            base_amount=base_amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            advance_paid=Decimal("0.00"),
            payment_status="unpaid",
            booking_status="pending",
            source="website",
            special_requests=data.special_requests,
        )
        db.add(booking)
        await db.flush()

        # Initial history entry
        history = BookingHistory(
            booking_id=booking.id,
            from_status="none",
            to_status="pending",
            notes="Online booking request placed via website",
        )
        db.add(history)
        await db.commit()
        await db.refresh(booking)
        return booking


async def update_booking_status(
    db: AsyncSession, booking: Booking, update_data: BookingStatusUpdate, user_id: str | None = None
) -> Booking:
    """
    Validates and updates booking status according to the finite state machine.
    """
    current_status = booking.booking_status
    new_status = update_data.status

    # Validate and assign room if specified
    if update_data.assigned_room_id:
        assigned_room = await db.get(Room, update_data.assigned_room_id)
        if not assigned_room or assigned_room.is_deleted:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assigned room not found.")
        if assigned_room.room_type_id != booking.room_type_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned room does not match the room category of this booking.",
            )

        # Check conflict with overlapping active bookings for this physical room
        conflict_stmt = select(Booking).where(
            Booking.assigned_room_id == update_data.assigned_room_id,
            Booking.id != booking.id,
            Booking.is_deleted == False,
            Booking.booking_status.in_(["confirmed", "checked_in"]),
            Booking.check_in_date < booking.check_out_date,
            Booking.check_out_date > booking.check_in_date,
        )
        conflict = (await db.execute(conflict_stmt)).scalars().first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Room {assigned_room.room_number} is already assigned to booking #{conflict.booking_reference} ({conflict.check_in_date} to {conflict.check_out_date}).",
            )
        booking.assigned_room_id = update_data.assigned_room_id

    if new_status == current_status:
        if update_data.assigned_room_id:
            await db.commit()
            await db.refresh(booking)
        return booking

    allowed_next = ALLOWED_BOOKING_TRANSITIONS.get(current_status, set())
    if new_status not in allowed_next:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition booking from '{current_status}' to '{new_status}'. Allowed transitions: {sorted(list(allowed_next))}",
        )

    # When confirming a booking, verify inventory is actually available
    if new_status == "confirmed" and current_status != "confirmed":
        is_avail, avail_count, r_type = await check_room_availability(
            db, booking.room_type_id, booking.check_in_date, booking.check_out_date, requested_rooms=booking.num_rooms
        )
        if not is_avail:
            type_name = r_type.name if r_type else "Room"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot confirm booking: {type_name} is fully booked for {booking.check_in_date} to {booking.check_out_date}. 0 rooms available for these dates.",
            )

    # Manage room status changes on check-in, check-out, or cancellation
    if new_status == "checked_in" and booking.assigned_room_id:
        room = await db.get(Room, booking.assigned_room_id)
        if room:
            room.status = "occupied"
    elif new_status == "checked_out" and booking.assigned_room_id:
        room = await db.get(Room, booking.assigned_room_id)
        if room:
            room.status = "cleaning"
    elif new_status in ("cancelled", "no_show") and booking.assigned_room_id:
        room = await db.get(Room, booking.assigned_room_id)
        if room and room.status == "occupied":
            room.status = "cleaning"

    # Save previous and update
    booking.booking_status = new_status
    if update_data.cancellation_reason:
        booking.cancellation_reason = update_data.cancellation_reason
    if update_data.admin_notes:
        booking.admin_notes = update_data.admin_notes

    # Record history
    history = BookingHistory(
        booking_id=booking.id,
        from_status=current_status,
        to_status=new_status,
        changed_by_user_id=user_id,
        notes=update_data.admin_notes or update_data.cancellation_reason,
    )
    db.add(history)
    await db.commit()
    await db.refresh(booking)
    return booking
