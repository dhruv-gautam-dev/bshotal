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
from app.services.availability import check_room_availability, format_date_ranges
from app.services.pricing import calculate_room_pricing

_booking_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

ALLOWED_BOOKING_TRANSITIONS = {
    "pending": {"confirmed", "cancelled"},
    "confirmed": {"checked_in", "cancelled", "no_show", "pending"},
    "checked_in": {"checked_out", "cancelled"},
    "checked_out": set(),
    "cancelled": {"pending", "confirmed"},
    "no_show": {"confirmed", "pending"},
    "failed": {"pending", "confirmed", "cancelled"},
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
    if not customer and email:
        email_stmt = select(Customer).where(Customer.email == email, Customer.is_deleted == False)
        email_res = await db.execute(email_stmt)
        customer = email_res.scalar_one_or_none()

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
    If rooms are unavailable, records customer details with a failed booking tag and
    logs a failed booking entry before notifying admins and returning clear availability dates.
    """
    if data.honeypot:
        # Bot detected
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request")

    async with _booking_locks[data.room_type_id]:
        # Concurrency check with row lock
        avail_res = await check_room_availability(
            db,
            room_type_id=data.room_type_id,
            check_in=data.check_in_date,
            check_out=data.check_out_date,
            requested_rooms=data.num_rooms,
            for_update=True,
        )
        is_avail, avail_count, room_type = avail_res

        if not room_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected room category not found.",
            )

        if not is_avail:
            avail_dates = getattr(avail_res, "available_dates", [])
            booked_dates = getattr(avail_res, "booked_dates", [])
            type_name = room_type.name or "Selected room type"

            if avail_dates:
                avail_str = format_date_ranges(avail_dates)
                booked_str = format_date_ranges(booked_dates) if booked_dates else ""
                detail_msg = f"{type_name} is not available for your entire stay. The hotel is available for these dates: {avail_str}."
                if booked_str:
                    detail_msg += f" (Already booked on: {booked_str})."
                detail_msg += " Please choose different dates."
            else:
                s_fmt = f"{data.check_in_date.day} {data.check_in_date.strftime('%b')}"
                e_fmt = f"{data.check_out_date.day} {data.check_out_date.strftime('%b')}"
                detail_msg = f"{type_name} is fully booked for all chosen dates ({s_fmt} to {e_fmt}). Please choose different dates or select another room type."

            # Capture guest contact details into customer database with tag
            customer = await get_or_create_customer(
                db, phone=data.guest_phone, name=data.guest_name, email=data.guest_email
            )
            date_summary = f"{data.check_in_date.isoformat()} to {data.check_out_date.isoformat()}"
            tag_note = f"[Tag: failed_booking] [Attempted: {type_name} ({date_summary}) - Room Unavailable]"
            if customer.notes:
                if tag_note not in customer.notes:
                    customer.notes = f"{customer.notes}\n{tag_note}"
            else:
                customer.notes = tag_note

            # Save the failed booking attempt so admin has full visibility
            failed_ref = generate_booking_reference()
            failed_booking = Booking(
                booking_reference=failed_ref,
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
                base_amount=Decimal("0.00"),
                tax_amount=Decimal("0.00"),
                total_amount=Decimal("0.00"),
                advance_paid=Decimal("0.00"),
                payment_status="unpaid",
                booking_status="failed",
                source="website",
                cancellation_reason=detail_msg,
                admin_notes=f"Room unavailable attempt: {detail_msg}",
                special_requests=data.special_requests,
            )
            db.add(failed_booking)
            await db.flush()

            history = BookingHistory(
                booking_id=failed_booking.id,
                from_status="none",
                to_status="failed",
                notes=f"Public booking attempt failed due to room unavailability: {detail_msg}",
            )
            db.add(history)

            # In-app notification for admin/staff
            from app.services.notification_service import create_notification
            await create_notification(
                db,
                title=f"Failed Booking Attempt #{failed_ref}",
                message=f"Guest {data.guest_name} ({data.guest_phone}) attempted to book {type_name} for {date_summary} but rooms were unavailable.",
                category="booking",
                reference_id=failed_booking.id,
            )

            await db.commit()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=detail_msg,
            )

        # Server-side pricing calculation
        _, base_amount, _, tax_amount, total_amount = await calculate_room_pricing(
            db, room_type, data.check_in_date, data.check_out_date, data.num_rooms
        )

        customer = await get_or_create_customer(
            db, phone=data.guest_phone, name=data.guest_name, email=data.guest_email
        )

        is_upi = data.payment_mode == "upi_qr"
        pay_notes_parts = []
        if is_upi:
            pay_notes_parts.append("[PhonePe UPI QR Payment Proof]")
            if data.payment_utr:
                pay_notes_parts.append(f"UTR: {data.payment_utr}")
            if data.payment_name:
                pay_notes_parts.append(f"Payer: {data.payment_name}")
            if data.payment_screenshot:
                pay_notes_parts.append("Screenshot: Attached")
        admin_notes = " | ".join(pay_notes_parts) if pay_notes_parts else None

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
            payment_status="submitted" if is_upi else "unpaid",
            booking_status="pending",
            source="website",
            special_requests=data.special_requests,
            admin_notes=admin_notes,
        )
        db.add(booking)
        await db.flush()

        if is_upi:
            from app.models.payment import Payment
            pay_rec = Payment(
                payment_reference=f"PAY-{booking.booking_reference}",
                booking_id=booking.id,
                amount=total_amount,
                currency="INR",
                mode="upi",
                status="pending",
                payment_type="full",
                transaction_id=data.payment_utr,
                notes=f"Payer: {data.payment_name or data.guest_name} | UPI: 6377682442-6@ibl" + (" | Screenshot provided" if data.payment_screenshot else ""),
            )
            db.add(pay_rec)

        # Initial history entry
        history = BookingHistory(
            booking_id=booking.id,
            from_status="none",
            to_status="pending",
            notes="Online booking request placed via website" + (" (UPI QR Payment Submitted)" if is_upi else ""),
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
        avail_res = await check_room_availability(
            db,
            booking.room_type_id,
            booking.check_in_date,
            booking.check_out_date,
            requested_rooms=booking.num_rooms,
            exclude_booking_id=booking.id,
        )
        is_avail, avail_count, r_type = avail_res
        if not is_avail:
            type_name = r_type.name if r_type else "Room"
            avail_dates = getattr(avail_res, "available_dates", [])
            booked_dates = getattr(avail_res, "booked_dates", [])
            if avail_dates:
                avail_str = format_date_ranges(avail_dates)
                booked_str = format_date_ranges(booked_dates) if booked_dates else ""
                msg = f"Cannot confirm booking: {type_name} is only available for {avail_str} (Booked on: {booked_str})."
            else:
                msg = f"Cannot confirm booking: {type_name} is fully booked for {booking.check_in_date} to {booking.check_out_date}. 0 rooms available for these dates."
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=msg,
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
