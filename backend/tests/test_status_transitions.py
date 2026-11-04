from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.booking import Booking
from app.models.room_type import RoomType
from app.models.user import User


@pytest.mark.asyncio
async def test_booking_status_machine_rules(client: AsyncClient, db_session: AsyncSession):
    # Setup staff user
    staff = User(
        email="receptionist@bshotel.com",
        phone="+919800112233",
        full_name="Staff One",
        role="staff",
        hashed_password=get_password_hash("Pass123"),
        is_active=True,
    )
    rt = RoomType(
        name="Deluxe Room",
        slug="deluxe",
        description="Comfort room",
        base_price=Decimal("1500.00"),
        total_inventory=5,
    )
    db_session.add_all([staff, rt])
    await db_session.flush()

    booking = Booking(
        booking_reference="BSH-2026-TEST01",
        room_type_id=rt.id,
        guest_name="Karan Malhotra",
        guest_phone="+919876543210",
        check_in_date=date.today(),
        check_out_date=date.today() + timedelta(days=1),
        num_rooms=1,
        num_guests=1,
        base_amount=Decimal("1500.00"),
        tax_amount=Decimal("180.00"),
        total_amount=Decimal("1680.00"),
        booking_status="pending",
    )
    db_session.add(booking)
    await db_session.commit()

    # Login staff
    login_res = await client.post(
        "/api/v1/auth/login", json={"username": "receptionist@bshotel.com", "password": "Pass123"}
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Illegal transition: pending -> checked_out (Must fail with 422!)
    illegal_res = await client.patch(
        f"/api/v1/admin/bookings/{booking.id}/status",
        json={"status": "checked_out"},
        headers=headers,
    )
    assert illegal_res.status_code == 422
    assert "Cannot transition" in illegal_res.json()["error"]

    # 2. Legal transition: pending -> confirmed (Must succeed 200)
    legal_res = await client.patch(
        f"/api/v1/admin/bookings/{booking.id}/status", json={"status": "confirmed"}, headers=headers
    )
    assert legal_res.status_code == 200
    assert legal_res.json()["booking_status"] == "confirmed"
