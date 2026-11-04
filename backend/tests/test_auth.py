import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models.user import User


@pytest.mark.asyncio
async def test_auth_flow(client: AsyncClient, db_session: AsyncSession):
    # 1. Create owner and staff users
    owner = User(
        email="testowner@bshotel.com",
        phone="+919800000001",
        full_name="Test Owner",
        role="owner",
        hashed_password=get_password_hash("Secret123"),
        is_active=True,
    )
    staff = User(
        email="teststaff@bshotel.com",
        phone="+919800000002",
        full_name="Test Staff",
        role="staff",
        hashed_password=get_password_hash("Secret123"),
        is_active=True,
    )
    db_session.add_all([owner, staff])
    await db_session.commit()

    # 2. Login by email
    res = await client.post(
        "/api/v1/auth/login", json={"username": "testowner@bshotel.com", "password": "Secret123"}
    )
    assert res.status_code == 200
    owner_token = res.json()["access_token"]
    assert res.json()["user"]["role"] == "owner"

    # 3. Login by phone
    res_phone = await client.post(
        "/api/v1/auth/login", json={"username": "+919800000002", "password": "Secret123"}
    )
    assert res_phone.status_code == 200
    staff_token = res_phone.json()["access_token"]
    assert res_phone.json()["user"]["role"] == "staff"

    # 4. Invalid password
    res_fail = await client.post(
        "/api/v1/auth/login",
        json={"username": "testowner@bshotel.com", "password": "WrongPassword"},
    )
    assert res_fail.status_code == 401

    # 5. Access owner-only endpoint with owner token
    res_owner_access = await client.get(
        "/api/v1/admin/staff", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert res_owner_access.status_code == 200

    # 6. Access owner-only endpoint with staff token (Must return 403 Forbidden!)
    res_staff_forbidden = await client.get(
        "/api/v1/admin/staff", headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert res_staff_forbidden.status_code == 403
