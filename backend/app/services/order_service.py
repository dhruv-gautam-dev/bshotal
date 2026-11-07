import math
import random
import string
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.menu import MenuItem
from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.models.setting import Setting
from app.schemas.order import OrderCreatePublic, OrderStatusUpdate
from app.services.booking_service import get_or_create_customer

# Known Mathura localities that are beyond the 1 km delivery radius of B.S. Hotel (NH-2, Baad)
KNOWN_FAR_MATHURA_AREAS = [
    ("maholi", "Maholi Road", 8.5),
    ("lajpat nagar", "Lajpat Nagar", 9.5),
    ("dampier", "Dampier Nagar", 8.5),
    ("krishna nagar", "Krishna Nagar (City)", 9.0),
    ("civil lines", "Civil Lines", 10.0),
    ("bsa", "BSA College Area", 8.5),
    ("bhuteshwar", "Bhuteshwar", 9.5),
    ("vrindavan", "Vrindavan", 22.0),
    ("chhatikara", "Chhatikara", 18.0),
    ("govardhan", "Govardhan", 28.0),
    ("radha kund", "Radha Kund", 26.0),
    ("barsana", "Barsana", 45.0),
    ("kosi", "Kosi Kalan", 45.0),
    ("masani", "Masani", 11.0),
    ("govind nagar", "Govind Nagar", 10.0),
    ("janmabhoomi", "Janmabhoomi Area", 10.5),
    ("aurangabad", "Aurangabad", 5.5),
    ("highway city", "Highway City", 8.0),
    ("chandan van", "Chandan Van", 7.5),
    ("radhika vihar", "Radhika Vihar", 9.0),
    ("shri nagar", "Shri Nagar", 8.5),
    ("gokul", "Gokul", 9.5),
    ("farah", "Farah", 12.0),
    ("raya", "Raya", 16.0),
    ("sonkh", "Sonkh", 18.0),
    ("baldeo", "Baldeo", 22.0),
    ("cantt", "Mathura Cantt", 11.0),
    ("holi gate", "Holi Gate", 10.0),
    ("vishram ghat", "Vishram Ghat", 10.5),
    ("deeg gate", "Deeg Gate", 10.0),
    ("bharatpur gate", "Bharatpur Gate", 9.5),
    ("manoharpura", "Manoharpura", 9.0),
    ("motikunj", "Motikunj", 8.5),
]


def check_mathura_out_of_range(address_text: str) -> tuple[str, float] | None:
    txt = (address_text or "").lower()
    for kw, name, dist in KNOWN_FAR_MATHURA_AREAS:
        if kw in txt:
            # Special case: don't flag "Krishna Nagar Ext" near Baad
            if kw == "krishna nagar" and ("ext" in txt or "baad" in txt):
                continue
            return name, dist
    return None


HOTEL_LAT = 27.4250
HOTEL_LNG = 77.6920
MAX_DELIVERY_RADIUS_KM = 1.25  # Strict 1 km + minor GPS tolerance buffer


def compute_haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

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

    # Delivery radius and minimum order check
    detected_distance = None
    delivery_addr = data.delivery_address or ""

    if data.order_type == "delivery":
        if subtotal < min_delivery_order:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Minimum order amount for delivery is Rs. {min_delivery_order:.2f}",
            )

        # Check text-based Mathura locality blacklist / distance match
        out_of_range_match = check_mathura_out_of_range(f"{data.delivery_address} {data.delivery_landmark or ''}")
        if out_of_range_match:
            area_name, approx_dist = out_of_range_match
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Delivery is strictly limited to 1 km around B.S. Hotel (NH-2, Baad). "
                    f"'{area_name}' is approximately {approx_dist:.1f} km away. "
                    f"Please choose 'Pickup' or contact the restaurant at +91 91492 24039."
                ),
            )

        # 1 km distance verification via GPS coordinates
        if data.delivery_lat is not None and data.delivery_lng is not None:
            detected_distance = compute_haversine_distance_km(
                HOTEL_LAT, HOTEL_LNG, float(data.delivery_lat), float(data.delivery_lng)
            )
            if detected_distance > MAX_DELIVERY_RADIUS_KM:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Delivery is strictly limited to 1 km around B.S. Hotel & Restaurant. "
                        f"Your location is ~{detected_distance:.2f} km away. "
                        f"Please choose 'Pickup' or contact the restaurant at +91 91492 24039."
                    ),
                )

        # Distance verification via explicitly sent distance_km
        if data.delivery_distance_km is not None and data.delivery_distance_km > MAX_DELIVERY_RADIUS_KM:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Selected delivery location is beyond our 1 km radius (~{data.delivery_distance_km:.2f} km). "
                    f"Please choose 'Pickup' or contact the restaurant directly."
                ),
            )

        # Enrich delivery address with landmark and distance
        if data.delivery_landmark:
            delivery_addr = f"{delivery_addr} (Landmark: {data.delivery_landmark})"
        if detected_distance is not None:
            delivery_addr = f"{delivery_addr} [~{detected_distance:.2f} km from hotel]"
        elif data.delivery_distance_km is not None:
            delivery_addr = f"{delivery_addr} [~{data.delivery_distance_km:.2f} km from hotel]"

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

    is_upi = (data.payment_mode or "").lower() in ("upi_qr", "upi")
    notes_list = []
    if is_upi:
        notes_list.append(
            f"[PhonePe UPI QR | UTR: {data.payment_utr or 'N/A'} | Payer: {data.payment_name or data.customer_name}]"
        )
        if data.payment_screenshot:
            notes_list.append(f"[Screenshot proof attached: {data.payment_screenshot[:60]}...]")
    if data.kitchen_notes:
        notes_list.append(data.kitchen_notes)
    final_notes = "\n".join(notes_list) if notes_list else None

    order = Order(
        order_reference=generate_order_reference(),
        customer_id=customer.id,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_email=data.customer_email,
        order_type=data.order_type,
        table_number=data.table_number,
        delivery_address=delivery_addr if data.order_type == "delivery" else None,
        subtotal=subtotal,
        tax_amount=tax_amount,
        delivery_fee=delivery_fee,
        discount_amount=Decimal("0.00"),
        total_amount=total_amount,
        status="new",
        payment_status="submitted" if is_upi else "unpaid",
        payment_mode="upi" if is_upi else (data.payment_mode or "cash"),
        kitchen_notes=final_notes,
        estimated_prep_minutes=25 if data.order_type != "delivery" else 40,
    )
    db.add(order)
    await db.flush()

    # If UPI QR, record linked Payment record
    if is_upi:
        pay_rec = Payment(
            payment_reference=f"PAY-{order.order_reference}",
            order_id=order.id,
            amount=total_amount,
            currency="INR",
            mode="upi",
            status="pending",
            payment_type="full",
            transaction_id=data.payment_utr,
            notes=(
                f"PhonePe UPI QR payment proof. Payer: {data.payment_name or data.customer_name} | "
                f"UPI: 6377682442-6@ibl"
                + (" | Screenshot provided" if data.payment_screenshot else "")
            ),
        )
        db.add(pay_rec)

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
