import csv
import io
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, require_manager, require_staff
from app.models.menu import MenuItem
from app.models.order import Order, OrderItem
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.order import OrderCreateAdmin, OrderOut, OrderStatusUpdate, OrderUpdateAdmin
from app.services.audit_service import log_audit_event
from app.services.booking_service import get_or_create_customer
from app.services.notification_service import broadcaster
from app.services.order_service import generate_order_reference, update_order_status
from app.utils.pagination import paginate_list
from app.utils.pdf import generate_order_bill_pdf, generate_order_kot_pdf

router = APIRouter(prefix="/orders", tags=["Admin Orders & Kitchen"])


@router.get("", response_model=PaginatedResponse[OrderOut])
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    status_filter: str | None = Query(None, alias="status"),
    order_type: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = (
        select(Order)
        .where(Order.is_deleted == False)
        .options(selectinload(Order.items), selectinload(Order.payments))
        .order_by(Order.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if order_type:
        stmt = stmt.where(Order.order_type == order_type)
    if search:
        search_fmt = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Order.order_reference.ilike(search_fmt),
                Order.customer_name.ilike(search_fmt),
                Order.customer_phone.ilike(search_fmt),
                Order.table_number.ilike(search_fmt),
            )
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    paginated_stmt = stmt.offset((page - 1) * limit).limit(limit)
    items = (await db.execute(paginated_stmt)).scalars().all()

    return paginate_list(items, total, page, limit)


@router.get("/export")
async def export_orders_csv(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_manager)
):
    stmt = (
        select(Order)
        .where(Order.is_deleted == False)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    )
    res = await db.execute(stmt)
    orders = res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Reference",
            "Date",
            "Customer",
            "Phone",
            "Type",
            "Table",
            "Subtotal",
            "Tax",
            "Delivery",
            "Total",
            "Status",
            "Payment",
            "Items",
        ]
    )

    for o in orders:
        items_summary = "; ".join([f"{it.item_name} x{it.quantity}" for it in o.items])
        writer.writerow(
            [
                o.order_reference,
                o.created_at.strftime("%Y-%m-%d %H:%M"),
                o.customer_name,
                o.customer_phone,
                o.order_type,
                o.table_number or "",
                f"{o.subtotal:.2f}",
                f"{o.tax_amount:.2f}",
                f"{o.delivery_fee:.2f}",
                f"{o.total_amount:.2f}",
                o.status,
                o.payment_status,
                items_summary,
            ]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders.csv"},
    )


@router.get("/{order_id}", response_model=OrderOut)
async def get_order_detail(
    order_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    stmt = (
        select(Order)
        .where(Order.id == order_id, Order.is_deleted == False)
        .options(selectinload(Order.items), selectinload(Order.payments))
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.post("", response_model=OrderOut)
async def create_manual_order(
    data: OrderCreateAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    customer = await get_or_create_customer(
        db, phone=data.customer_phone, name=data.customer_name, email=data.customer_email
    )

    # Recalculate prices from DB
    item_ids = [it.menu_item_id for it in data.items]
    res = await db.execute(select(MenuItem).where(MenuItem.id.in_(item_ids)))
    db_items = {it.id: it for it in res.scalars().all()}

    subtotal = sum(db_items[it.menu_item_id].price * it.quantity for it in data.items)
    tax_amount = subtotal * Decimal("0.05")
    total_amount = subtotal + tax_amount

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
        delivery_fee=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        total_amount=total_amount,
        status=data.status,
        payment_status=data.payment_status,
        payment_mode=data.payment_mode,
        kitchen_notes=data.kitchen_notes,
    )
    db.add(order)
    await db.flush()

    for it in data.items:
        db_it = db_items[it.menu_item_id]
        order_item = OrderItem(
            order_id=order.id,
            menu_item_id=db_it.id,
            item_name=db_it.name,
            quantity=it.quantity,
            unit_price=db_it.price,
            total_price=db_it.price * it.quantity,
            special_instructions=it.special_instructions,
        )
        db.add(order_item)

    await db.commit()
    await log_audit_event(
        db,
        action="create",
        entity_type="order",
        entity_id=order.id,
        details={
            "ref": order.order_reference,
            "order_reference": order.order_reference,
            "customer_name": order.customer_name,
            "phone": order.customer_phone,
            "order_type": order.order_type,
            "table_number": order.table_number,
            "amount": str(order.total_amount),
            "total_amount": str(order.total_amount),
            "status": order.status,
            "items_count": len(data.items),
        },
        user=current_user,
    )
    await broadcaster.broadcast(
        "order_updated",
        {
            "action": "create",
            "id": order.id,
            "order_reference": order.order_reference,
            "status": order.status,
            "total_amount": str(order.total_amount),
        },
    )
    return await get_order_detail(order.id, db, current_user)


@router.put("/{order_id}", response_model=OrderOut)
async def update_order_details(
    order_id: str,
    data: OrderUpdateAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = (
        select(Order)
        .where(Order.id == order_id)
        .options(selectinload(Order.items), selectinload(Order.payments))
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order or order.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(order, field, val)

    await db.commit()

    # Broadcast updated values to SSE clients if status or total changed
    await broadcaster.broadcast(
        "order_updated",
        {
            "id": order.id,
            "order_reference": order.order_reference,
            "status": order.status,
            "total_amount": str(order.total_amount),
            "payment_status": order.payment_status,
        },
    )

    await log_audit_event(
        db,
        action="update",
        entity_type="order",
        entity_id=order.id,
        details=data.model_dump(exclude_unset=True),
        user=current_user,
    )
    return await get_order_detail(order.id, db, current_user)


@router.patch("/{order_id}/status", response_model=OrderOut)
async def change_order_status(
    order_id: str,
    update_data: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order or order.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    updated = await update_order_status(db, order, update_data)

    # Broadcast status change to live kitchen and customer boards
    await broadcaster.broadcast(
        "order_status_updated",
        {
            "id": updated.id,
            "order_reference": updated.order_reference,
            "status": updated.status,
            "payment_status": updated.payment_status,
        },
    )

    await log_audit_event(
        db,
        action="status_change",
        entity_type="order",
        entity_id=order.id,
        details={
            "ref": updated.order_reference,
            "order_reference": updated.order_reference,
            "customer_name": updated.customer_name,
            "phone": updated.customer_phone,
            "order_type": updated.order_type,
            "table_number": updated.table_number,
            "amount": str(updated.total_amount),
            "new_status": update_data.status,
            "status": update_data.status,
        },
        user=current_user,
    )
    return await get_order_detail(updated.id, db, current_user)


@router.get("/{order_id}/kot")
async def download_order_kot(
    order_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    stmt = select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    pdf_bytes = generate_order_kot_pdf(order)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=KOT-{order.order_reference}.pdf"},
    )


@router.get("/{order_id}/bill")
async def download_order_bill(
    order_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    stmt = select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    pdf_bytes = generate_order_bill_pdf(order)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Bill-{order.order_reference}.pdf"},
    )
