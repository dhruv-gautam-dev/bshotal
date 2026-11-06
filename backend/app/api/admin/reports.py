import csv
import io
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_manager, require_owner
from app.models.booking import Booking
from app.models.order import Order
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["Admin Reports (Owner)"])


@router.get("/summary")
async def get_financial_summary(
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    end_date: date = Query(default_factory=date.today),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    # Total room booking revenue
    b_res = await db.execute(
        select(
            func.coalesce(func.sum(Booking.base_amount), 0),
            func.coalesce(func.sum(Booking.tax_amount), 0),
            func.coalesce(func.sum(Booking.total_amount), 0),
            func.count(Booking.id),
        ).where(
            Booking.is_deleted == False,
            Booking.booking_status != "cancelled",
            func.date(Booking.created_at) >= start_date,
            func.date(Booking.created_at) <= end_date,
        )
    )
    b_base, b_tax, b_total, b_count = b_res.first()

    # Total food order revenue
    o_res = await db.execute(
        select(
            func.coalesce(func.sum(Order.subtotal), 0),
            func.coalesce(func.sum(Order.tax_amount), 0),
            func.coalesce(func.sum(Order.delivery_fee), 0),
            func.coalesce(func.sum(Order.total_amount), 0),
            func.count(Order.id),
        ).where(
            Order.is_deleted == False,
            Order.status != "cancelled",
            func.date(Order.created_at) >= start_date,
            func.date(Order.created_at) <= end_date,
        )
    )
    o_sub, o_tax, o_del, o_total, o_count = o_res.first()

    b_total_dec = Decimal(str(b_total))
    o_total_dec = Decimal(str(o_total))

    return {
        "period": {"start_date": start_date, "end_date": end_date},
        "rooms": {
            "bookings_count": b_count,
            "base_amount": Decimal(str(b_base)),
            "gst_collected": Decimal(str(b_tax)),
            "total_revenue": b_total_dec,
        },
        "restaurant": {
            "orders_count": o_count,
            "subtotal": Decimal(str(o_sub)),
            "gst_collected": Decimal(str(o_tax)),
            "delivery_collected": Decimal(str(o_del)),
            "total_revenue": o_total_dec,
        },
        "grand_total_revenue": b_total_dec + o_total_dec,
        "total_gst_collected": Decimal(str(b_tax)) + Decimal(str(o_tax)),
    }


@router.get("/export")
async def export_financial_report_csv(
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    end_date: date = Query(default_factory=date.today),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Type", "Reference", "Date", "Customer", "Subtotal", "GST", "Total", "Status"])

    # Bookings
    b_rows = (
        (
            await db.execute(
                select(Booking).where(
                    Booking.is_deleted == False,
                    func.date(Booking.created_at) >= start_date,
                    func.date(Booking.created_at) <= end_date,
                )
            )
        )
        .scalars()
        .all()
    )
    for b in b_rows:
        writer.writerow(
            [
                "Room Booking",
                b.booking_reference,
                b.created_at.strftime("%Y-%m-%d"),
                b.guest_name,
                f"{b.base_amount:.2f}",
                f"{b.tax_amount:.2f}",
                f"{b.total_amount:.2f}",
                b.booking_status,
            ]
        )

    # Orders
    o_rows = (
        (
            await db.execute(
                select(Order).where(
                    Order.is_deleted == False,
                    func.date(Order.created_at) >= start_date,
                    func.date(Order.created_at) <= end_date,
                )
            )
        )
        .scalars()
        .all()
    )
    for o in o_rows:
        writer.writerow(
            [
                "Food Order",
                o.order_reference,
                o.created_at.strftime("%Y-%m-%d"),
                o.customer_name,
                f"{o.subtotal:.2f}",
                f"{o.tax_amount:.2f}",
                f"{o.total_amount:.2f}",
                o.status,
            ]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=revenue_report_{start_date}_{end_date}.csv"
        },
    )
