import hashlib
import hmac
import random
import string
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.booking import Booking
from app.models.order import Order
from app.models.payment import Payment
from app.schemas.payment import PaymentCreate


def generate_payment_reference() -> str:
    year = datetime.now(UTC).year
    rand_chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"PAY-{year}-{rand_chars}"


async def record_payment(
    db: AsyncSession, data: PaymentCreate, user_id: str | None = None
) -> Payment:
    payment = Payment(
        payment_reference=generate_payment_reference(),
        booking_id=data.booking_id,
        order_id=data.order_id,
        amount=data.amount,
        currency=data.currency,
        mode=data.mode,
        status=data.status,
        payment_type=data.payment_type,
        transaction_id=data.transaction_id,
        gateway_order_id=data.gateway_order_id,
        gateway_payment_id=data.gateway_payment_id,
        notes=data.notes,
        recorded_by_user_id=user_id,
    )
    db.add(payment)

    # If linked to booking, update booking payment metrics
    if data.booking_id:
        booking = await db.get(Booking, data.booking_id)
        if booking and data.status == "completed":
            booking.advance_paid += data.amount
            if booking.advance_paid >= booking.total_amount:
                booking.payment_status = "paid"
            elif booking.advance_paid > 0:
                booking.payment_status = "partial"

    # If linked to order, update order payment status
    if data.order_id:
        order = await db.get(Order, data.order_id)
        if order and data.status == "completed":
            order.payment_status = "paid"
            order.payment_mode = data.mode

    await db.commit()
    await db.refresh(payment)
    return payment


def verify_razorpay_webhook_signature(payload_body: bytes, signature: str) -> bool:
    """Verifies HMAC SHA256 webhook signature from Razorpay."""
    if not settings.RAZORPAY_KEY_SECRET:
        return False
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"), payload_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
