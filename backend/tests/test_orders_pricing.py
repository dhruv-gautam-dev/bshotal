from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.menu import MenuCategory, MenuItem


@pytest.mark.asyncio
async def test_order_pricing_integrity(client: AsyncClient, db_session: AsyncSession):
    # Setup category & items
    cat = MenuCategory(name="Breads", slug="breads")
    db_session.add(cat)
    await db_session.flush()

    item1 = MenuItem(
        category_id=cat.id, name="Butter Naan", price=Decimal("60.00"), is_available=True
    )
    item2 = MenuItem(
        category_id=cat.id, name="Paneer Butter Masala", price=Decimal("280.00"), is_available=True
    )
    db_session.add_all([item1, item2])
    await db_session.commit()

    # Payload has only menu_item_id and quantity (no client price!)
    payload = {
        "customer_name": "Deepak Kumar",
        "customer_phone": "+919876543210",
        "order_type": "dine-in",
        "table_number": "T-05",
        "items": [
            {"menu_item_id": item1.id, "quantity": 2},  # 2 x 60 = 120
            {"menu_item_id": item2.id, "quantity": 1},  # 1 x 280 = 280
        ],
    }
    # Expected: Subtotal = 400.00, GST (5%) = 20.00, Total = 420.00

    res = await client.post("/api/v1/public/orders", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert Decimal(str(data["total_amount"])) == Decimal("420.00")
    assert "ORD-" in data["order_reference"]
