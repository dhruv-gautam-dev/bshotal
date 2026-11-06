from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db
from app.models.order import Order
from app.schemas.order import OrderCreatePublic, OrderPublicStatus
from app.services.notification_service import broadcaster, create_notification
from app.services.order_service import create_public_order
from app.utils.whatsapp import get_whatsapp_order_link

router = APIRouter(prefix="/orders", tags=["Public Orders"])


@router.post("", response_model=dict)
async def submit_public_order(order_in: OrderCreatePublic, db: AsyncSession = Depends(get_db)):
    order = await create_public_order(db, order_in)

    whatsapp_link = get_whatsapp_order_link(
        order_ref=order.order_reference,
        total=f"{order.total_amount:.2f}",
        customer_name=order.customer_name,
    )

    # Broadcast to live kitchen / order board
    await broadcaster.broadcast(
        "new_order",
        {
            "id": order.id,
            "order_reference": order.order_reference,
            "customer_name": order.customer_name,
            "order_type": order.order_type,
            "table_number": order.table_number,
            "total_amount": float(order.total_amount),
            "status": order.status,
            "created_at": order.created_at.isoformat(),
        },
    )
    await broadcaster.broadcast(
        "order_updated",
        {
            "id": order.id,
            "order_reference": order.order_reference,
            "status": order.status,
            "total_amount": str(order.total_amount),
        },
    )

    # In-app notification
    await create_notification(
        db,
        title=f"New Food Order #{order.order_reference}",
        message=f"{order.customer_name} placed {order.order_type} order for Rs. {order.total_amount:.2f}",
        category="order",
        reference_id=order.id,
    )

    return {
        "success": True,
        "order_reference": order.order_reference,
        "total_amount": order.total_amount,
        "status": order.status,
        "whatsapp_url": whatsapp_link,
        "message": "Order successfully received by Delicee Restaurant",
    }


@router.get("/status", response_model=OrderPublicStatus)
async def get_public_order_status(
    reference: str = Query(..., description="Order Reference (ORD-YYYY-XXXXXX)"),
    phone: str = Query(..., description="Customer 10-digit Phone"),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Order)
        .where(
            Order.order_reference == reference.strip(),
            Order.customer_phone.endswith(phone.strip()[-10:]),
            Order.is_deleted == False,
        )
        .options(selectinload(Order.items))
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found. Please verify the order reference and phone number.",
        )

    return OrderPublicStatus(
        order_reference=order.order_reference,
        customer_name=order.customer_name,
        order_type=order.order_type,
        status=order.status,
        payment_status=order.payment_status,
        total_amount=order.total_amount,
        estimated_prep_minutes=order.estimated_prep_minutes,
        created_at=order.created_at,
        items_count=len(order.items),
    )
