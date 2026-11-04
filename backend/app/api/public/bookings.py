from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.room_type import RoomType
from app.schemas.booking import BookingCreatePublic, BookingPublicResponse
from app.services.booking_service import create_public_booking
from app.services.notification_service import build_whatsapp_booking_url, create_notification

router = APIRouter(prefix="/bookings", tags=["Public Bookings"])


@router.post("", response_model=BookingPublicResponse)
async def submit_public_booking(
    booking_in: BookingCreatePublic, db: AsyncSession = Depends(get_db)
):
    booking = await create_public_booking(db, booking_in)
    room_type = await db.get(RoomType, booking.room_type_id)
    room_type_name = room_type.name if room_type else "Selected Room"

    whatsapp_url = build_whatsapp_booking_url(
        guest_name=booking.guest_name,
        booking_reference=booking.booking_reference,
        room_type_name=room_type_name,
        check_in=booking.check_in_date.isoformat(),
        check_out=booking.check_out_date.isoformat(),
        total_amount=f"{booking.total_amount:.2f}",
    )

    # In-app notification for admin/manager/staff
    await create_notification(
        db,
        title=f"New Room Booking #{booking.booking_reference}",
        message=f"Guest {booking.guest_name} booked {room_type_name} for {booking.check_in_date} ({booking.guest_phone})",
        category="booking",
        reference_id=booking.id,
    )

    return BookingPublicResponse(
        booking_reference=booking.booking_reference,
        guest_name=booking.guest_name,
        check_in_date=booking.check_in_date,
        check_out_date=booking.check_out_date,
        total_amount=booking.total_amount,
        booking_status=booking.booking_status,
        whatsapp_url=whatsapp_url,
        message="Your booking request has been submitted. Our manager will confirm shortly.",
    )
