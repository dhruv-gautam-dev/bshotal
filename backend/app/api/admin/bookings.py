from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, require_manager, require_staff
from app.models.booking import Booking, BookingHistory
from app.models.room import Room
from app.models.room_type import RoomType
from app.models.user import User
from app.schemas.booking import (
    BookingCreateAdmin,
    BookingOut,
    BookingStatusUpdate,
    BookingUpdateAdmin,
)
from app.schemas.common import PaginatedResponse
from app.schemas.payment import PaymentCreate, PaymentOut
from app.services.audit_service import log_audit_event
from app.services.booking_service import (
    generate_booking_reference,
    get_or_create_customer,
    update_booking_status,
)
from app.services.notification_service import broadcaster
from app.services.payment_service import record_payment
from app.utils.pagination import paginate_list
from app.utils.pdf import generate_booking_invoice_pdf

router = APIRouter(prefix="/bookings", tags=["Admin Bookings"])


@router.get("", response_model=PaginatedResponse[BookingOut])
async def list_bookings(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    status_filter: str | None = Query(None, alias="status"),
    room_type_id: str | None = None,
    search: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = (
        select(Booking)
        .where(Booking.is_deleted == False)
        .options(
            selectinload(Booking.history),
            selectinload(Booking.payments),
            selectinload(Booking.assigned_room),
            selectinload(Booking.room_type),
        )
        .order_by(Booking.created_at.desc())
    )

    if status_filter:
        stmt = stmt.where(Booking.booking_status == status_filter)
    if room_type_id:
        stmt = stmt.where(Booking.room_type_id == room_type_id)
    if start_date:
        stmt = stmt.where(Booking.check_in_date >= start_date)
    if end_date:
        stmt = stmt.where(Booking.check_out_date <= end_date)
    if search:
        search_fmt = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Booking.booking_reference.ilike(search_fmt),
                Booking.guest_name.ilike(search_fmt),
                Booking.guest_phone.ilike(search_fmt),
            )
        )

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginate
    offset = (page - 1) * limit
    paginated_stmt = stmt.offset(offset).limit(limit)
    items = (await db.execute(paginated_stmt)).scalars().all()

    return paginate_list(items, total, page, limit)


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking_detail(
    booking_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    stmt = (
        select(Booking)
        .where(Booking.id == booking_id, Booking.is_deleted == False)
        .options(
            selectinload(Booking.history),
            selectinload(Booking.payments),
            selectinload(Booking.assigned_room),
            selectinload(Booking.room_type),
        )
    )
    res = await db.execute(stmt)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


@router.post("", response_model=BookingOut)
async def create_admin_booking(
    data: BookingCreateAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    customer = await get_or_create_customer(
        db, phone=data.guest_phone, name=data.guest_name, email=data.guest_email
    )

    booking = Booking(
        booking_reference=generate_booking_reference(),
        room_type_id=data.room_type_id,
        assigned_room_id=data.assigned_room_id,
        customer_id=customer.id,
        guest_name=data.guest_name,
        guest_phone=data.guest_phone,
        guest_email=data.guest_email,
        check_in_date=data.check_in_date,
        check_out_date=data.check_out_date,
        num_rooms=data.num_rooms,
        num_guests=data.num_guests,
        num_children=data.num_children,
        base_amount=data.base_amount,
        tax_amount=data.tax_amount,
        total_amount=data.total_amount,
        advance_paid=data.advance_paid,
        payment_status=data.payment_status,
        booking_status=data.booking_status,
        source=data.source,
        special_requests=data.special_requests,
        admin_notes=data.admin_notes,
        id_proof_type=data.id_proof_type,
        id_proof_number=data.id_proof_number,
    )
    db.add(booking)
    await db.flush()

    history = BookingHistory(
        booking_id=booking.id,
        from_status="none",
        to_status=data.booking_status,
        changed_by_user_id=current_user.id,
        notes="Manual booking created by admin/manager",
    )
    db.add(history)
    await db.commit()

    # Extract room number and room type for rich audit log
    room_number = None
    if booking.assigned_room_id:
        r = await db.get(Room, booking.assigned_room_id)
        if r:
            room_number = r.room_number
    rt = await db.get(RoomType, booking.room_type_id)
    room_type_name = rt.name if rt else None

    await log_audit_event(
        db,
        action="create",
        entity_type="booking",
        entity_id=booking.id,
        details={
            "ref": booking.booking_reference,
            "booking_reference": booking.booking_reference,
            "customer_name": booking.guest_name,
            "guest_name": booking.guest_name,
            "guest_phone": booking.guest_phone,
            "phone": booking.guest_phone,
            "room_number": room_number,
            "room_type": room_type_name,
            "check_in": str(booking.check_in_date),
            "check_out": str(booking.check_out_date),
            "num_rooms": booking.num_rooms,
            "num_guests": booking.num_guests,
            "total_amount": str(booking.total_amount),
            "advance_paid": str(booking.advance_paid),
            "status": booking.booking_status,
        },
        user=current_user,
    )

    await broadcaster.broadcast("booking_updated", {"action": "create", "id": booking.id})
    await broadcaster.broadcast("rooms_updated", {"action": "booking_inventory_changed"})

    # Return refreshed booking with relations
    return await get_booking_detail(booking.id, db, current_user)


@router.put("/{booking_id}", response_model=BookingOut)
async def update_booking_details(
    booking_id: str,
    data: BookingUpdateAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    booking = await db.get(Booking, booking_id)
    if not booking or booking.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(booking, field, val)

    await db.commit()

    room_number = None
    if booking.assigned_room_id:
        r = await db.get(Room, booking.assigned_room_id)
        if r:
            room_number = r.room_number
    rt = await db.get(RoomType, booking.room_type_id)
    room_type_name = rt.name if rt else None

    await log_audit_event(
        db,
        action="update",
        entity_type="booking",
        entity_id=booking.id,
        details={
            "ref": booking.booking_reference,
            "booking_reference": booking.booking_reference,
            "customer_name": booking.guest_name,
            "guest_name": booking.guest_name,
            "guest_phone": booking.guest_phone,
            "phone": booking.guest_phone,
            "room_number": room_number,
            "room_type": room_type_name,
            "check_in": str(booking.check_in_date),
            "check_out": str(booking.check_out_date),
            "status": booking.booking_status,
            "updated_fields": list(data.model_dump(exclude_unset=True).keys()),
            **data.model_dump(exclude_unset=True),
        },
        user=current_user,
    )
    await broadcaster.broadcast("booking_updated", {"action": "update", "id": booking.id})
    await broadcaster.broadcast("rooms_updated", {"action": "booking_inventory_changed"})
    return await get_booking_detail(booking.id, db, current_user)


@router.patch("/{booking_id}/status", response_model=BookingOut)
async def change_booking_status(
    booking_id: str,
    update_data: BookingStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    booking = await db.get(Booking, booking_id)
    if not booking or booking.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    updated = await update_booking_status(db, booking, update_data, user_id=current_user.id)

    room_number = None
    if updated.assigned_room_id:
        r = await db.get(Room, updated.assigned_room_id)
        if r:
            room_number = r.room_number
    rt = await db.get(RoomType, updated.room_type_id)
    room_type_name = rt.name if rt else None

    await log_audit_event(
        db,
        action="status_change",
        entity_type="booking",
        entity_id=booking.id,
        details={
            "ref": updated.booking_reference,
            "booking_reference": updated.booking_reference,
            "customer_name": updated.guest_name,
            "guest_name": updated.guest_name,
            "guest_phone": updated.guest_phone,
            "phone": updated.guest_phone,
            "room_number": room_number,
            "room_type": room_type_name,
            "check_in": str(updated.check_in_date),
            "check_out": str(updated.check_out_date),
            "new_status": update_data.status,
            "status": update_data.status,
            "reason": update_data.cancellation_reason,
        },
        user=current_user,
    )
    await broadcaster.broadcast("booking_updated", {"action": "status_change", "id": updated.id, "status": update_data.status})
    await broadcaster.broadcast("rooms_updated", {"action": "booking_inventory_changed"})
    return await get_booking_detail(updated.id, db, current_user)


@router.post("/{booking_id}/payments", response_model=PaymentOut)
async def record_booking_payment(
    booking_id: str,
    payment_in: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    payment_in.booking_id = booking_id
    payment = await record_payment(db, payment_in, user_id=current_user.id)

    booking = await db.get(Booking, booking_id)
    room_number = None
    if booking and booking.assigned_room_id:
        r = await db.get(Room, booking.assigned_room_id)
        if r:
            room_number = r.room_number

    await log_audit_event(
        db,
        action="payment_recorded",
        entity_type="booking",
        entity_id=booking_id,
        details={
            "ref": booking.booking_reference if booking else None,
            "booking_reference": booking.booking_reference if booking else None,
            "customer_name": booking.guest_name if booking else None,
            "guest_name": booking.guest_name if booking else None,
            "guest_phone": booking.guest_phone if booking else None,
            "phone": booking.guest_phone if booking else None,
            "room_number": room_number,
            "amount": str(payment.amount),
            "mode": payment.mode,
        },
        user=current_user,
    )
    await broadcaster.broadcast("booking_updated", {"action": "payment", "id": booking_id})
    return payment


@router.get("/{booking_id}/invoice")
async def download_booking_invoice(
    booking_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    booking = await db.get(Booking, booking_id)
    if not booking or booking.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")

    pdf_bytes = generate_booking_invoice_pdf(booking)
    filename = f"Invoice-{booking.booking_reference}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
