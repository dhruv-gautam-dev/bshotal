import asyncio
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.room import Room
from app.models.room_type import RoomType
from app.models.setting import Setting


@pytest.mark.asyncio
async def test_room_booking_concurrency_race(client: AsyncClient, db_session: AsyncSession):
    # 1. Setup setting
    setting = Setting(
        hotel_name="B.S. Hotel", room_tax_percent=Decimal("12.00"), bookings_phone="+919149224039"
    )
    # 2. Setup room type with ONLY 1 physical room
    rt = RoomType(
        name="Solo Penthouse",
        slug="solo-penthouse",
        description="Exclusive single room",
        base_price=Decimal("2000.00"),
        total_inventory=1,
        is_active=True,
    )
    db_session.add_all([setting, rt])
    await db_session.flush()

    room = Room(room_number="999", room_type_id=rt.id, status="available")
    db_session.add(room)
    await db_session.commit()

    check_in = (date.today() + timedelta(days=10)).isoformat()
    check_out = (date.today() + timedelta(days=12)).isoformat()

    booking_payload_1 = {
        "room_type_id": rt.id,
        "guest_name": "Rohan Sharma",
        "guest_phone": "+919876543210",
        "check_in_date": check_in,
        "check_out_date": check_out,
        "num_rooms": 1,
        "num_guests": 2,
    }

    booking_payload_2 = {
        "room_type_id": rt.id,
        "guest_name": "Amit Patel",
        "guest_phone": "+919811223344",
        "check_in_date": check_in,
        "check_out_date": check_out,
        "num_rooms": 1,
        "num_guests": 2,
    }

    # Execute both booking requests concurrently
    req1 = client.post("/api/v1/public/bookings", json=booking_payload_1)
    req2 = client.post("/api/v1/public/bookings", json=booking_payload_2)

    res1, res2 = await asyncio.gather(req1, req2)

    statuses = [res1.status_code, res2.status_code]

    # Exactly one request must succeed (200), and the other must be rejected with 409 Conflict
    assert 200 in statuses, f"Expected one 200 success, got {statuses}"
    assert 409 in statuses, f"Expected one 409 conflict, got {statuses}"
