import random
import string
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.menu import MenuItem
from app.models.order import Order, OrderItem
from app.models.setting import Setting
from app.schemas.order import OrderCreatePublic, OrderStatusUpdate
from app.services.booking_service import get_or_create_customer

ALLOWED_ORDER_TRANSITIONS = {
    "new": {"accepted", "cancelled"},
    "accepted": {"preparing", "cancelled"},
    "preparing": {"ready", "cancelled"},
    "ready": {"out_for_delivery", "served", "completed", "cancelled"},
    "out_for_delivery": {"completed", "cancelled"},
    "served": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def generate_order_reference() -> str:
    year = datetime.now(UTC).year
    rand_chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"ORD-{year}-{rand_chars}"


async def create_public_order(db: AsyncSession, data: OrderCreatePublic) -> Order:
    """
    Public order creation: recalculates ALL item prices from database,
    applies tax and delivery rules from settings.
    """
    if data.honeypot:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request")

    # Fetch settings
    setting_res = await db.execute(select(Setting).limit(1))
    setting = setting_res.scalar_one_or_none()
    if setting and not setting.is_online_ordering_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Online food ordering is currently disabled",
        )

    tax_percent = setting.restaurant_tax_percent if setting else Decimal("5.00")
    min_delivery_order = setting.min_delivery_order if setting else Decimal("199.00")
    delivery_charge = setting.delivery_charge if setting else Decimal("40.00")
    free_delivery_above = setting.free_delivery_above if setting else Decimal("499.00")

    # Fetch all requested menu items from DB in one query
    item_ids = [item.menu_item_id for item in data.items]
    stmt = select(MenuItem).where(MenuItem.id.in_(item_ids), MenuItem.is_deleted == False)
    res = await db.execute(stmt)
    db_items = {item.id: item for item in res.scalars().all()}

    subtotal = Decimal("0.00")
    order_items_to_create = []

    for item_input in data.items:
        db_item = db_items.get(item_input.menu_item_id)
        if not db_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Menu item '{item_input.menu_item_id}' not found",
            )
        if not db_item.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item '{db_item.name}' is currently out of stock",
            )

        unit_price = Decimal(str(db_item.price))
        item_total = (unit_price * item_input.quantity).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        subtotal += item_total

        order_items_to_create.append(
            {
                "menu_item_id": db_item.id,
                "item_name": db_item.name,
                "quantity": item_input.quantity,
                "unit_price": unit_price,
                "total_price": item_total,
                "special_instructions": item_input.special_instructions,
            }
        )

    # Minimum order check for delivery
    if data.order_type == "delivery" and subtotal < min_delivery_order:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum order amount for delivery is Rs. {min_delivery_order:.2f}",
        )

    # Delivery fee calculation
    delivery_fee = Decimal("0.00")
    if data.order_type == "delivery":
        if subtotal < free_delivery_above:
            delivery_fee = delivery_charge

    # Tax calculation
    tax_amount = (subtotal * (tax_percent / Decimal(100))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total_amount = subtotal + tax_amount + delivery_fee

    customer = await get_or_create_customer(
        db, phone=data.customer_phone, name=data.customer_name, email=data.customer_email
    )

    order = Order(
        order_reference=generate_order_reference(),
        customer_id=customer.id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_email=data.customer_email,
        order_type=data.order_type,
        table_number=data.table_number,
        delivery_address=data.delivery_address,
        subtotal=subtotal,
        tax_amount=tax_amount,
        delivery_fee=delivery_fee,
        discount_amount=Decimal("0.00"),
        total_amount=total_amount,
        status="new",
        payment_status="unpaid",
        kitchen_notes=data.kitchen_notes,
        estimated_prep_minutes=25 if data.order_type != "delivery" else 40,
    )
    db.add(order)
    await db.flush()

    for item_data in order_items_to_create:
        order_item = OrderItem(order_id=order.id, **item_data)
        db.add(order_item)

    await db.commit()
    await db.refresh(order)
    return order


async def update_order_status(
    db: AsyncSession, order: Order, update_data: OrderStatusUpdate
) -> Order:
    """
    Validates and transitions order status.
    """
    current_status = order.status
    new_status = update_data.status

    if new_status != current_status:
        allowed_next = ALLOWED_ORDER_TRANSITIONS.get(current_status, set())
        if new_status not in allowed_next:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot transition order from '{current_status}' to '{new_status}'. Allowed: {sorted(list(allowed_next))}",
            )
        order.status = new_status

    if update_data.cancellation_reason:
        order.cancellation_reason = update_data.cancellation_reason
    if update_data.payment_status:
        order.payment_status = update_data.payment_status
    if update_data.payment_mode:
        order.payment_mode = update_data.payment_mode

    await db.commit()
    await db.refresh(order)
    return order
