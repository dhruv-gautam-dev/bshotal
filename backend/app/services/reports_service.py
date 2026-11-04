from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking
from app.models.enquiry import Enquiry
from app.models.order import Order, OrderItem
from app.models.room import Room
from app.schemas.reports import (
    NeedsAttentionItem,
    OverviewKPIs,
    TimeSeriesPoint,
    TopDish,
)


async def get_overview_kpis(db: AsyncSession) -> OverviewKPIs:
    today = date.today()
    start_of_month = today.replace(day=1)

    # 1. Today's check-ins and check-outs
    checkins_res = await db.execute(
        select(func.count(Booking.id)).where(
            Booking.is_deleted == False,
            Booking.check_in_date == today,
            Booking.booking_status.in_(["confirmed", "checked_in"]),
        )
    )
    today_check_ins = checkins_res.scalar() or 0

    checkouts_res = await db.execute(
        select(func.count(Booking.id)).where(
            Booking.is_deleted == False,
            Booking.check_out_date == today,
            Booking.booking_status.in_(["checked_in", "checked_out"]),
        )
    )
    today_check_outs = checkouts_res.scalar() or 0

    # 2. Today's new bookings
    today_bookings_res = await db.execute(
        select(func.count(Booking.id)).where(
            Booking.is_deleted == False, func.date(Booking.created_at) == today
        )
    )
    today_bookings_count = today_bookings_res.scalar() or 0

    # 3. Occupancy calculation
    total_rooms_res = await db.execute(
        select(func.count(Room.id)).where(Room.is_deleted == False, Room.is_active == True)
    )
    total_rooms = total_rooms_res.scalar() or 10

    currently_occupied_res = await db.execute(
        select(func.count(Room.id)).where(Room.is_deleted == False, Room.status == "occupied")
    )
    occupied_rooms = currently_occupied_res.scalar() or 0
    occupancy_rate = round((occupied_rooms / total_rooms) * 100, 1) if total_rooms > 0 else 0.0

    # 4. Orders today
    orders_res = await db.execute(
        select(func.count(Order.id)).where(
            Order.is_deleted == False, func.date(Order.created_at) == today
        )
    )
    today_orders_count = orders_res.scalar() or 0

    pending_orders_res = await db.execute(
        select(func.count(Order.id)).where(
            Order.is_deleted == False, Order.status.in_(["new", "accepted", "preparing"])
        )
    )
    pending_orders_count = pending_orders_res.scalar() or 0

    # 5. Revenue today
    today_booking_rev_res = await db.execute(
        select(func.coalesce(func.sum(Booking.total_amount), 0)).where(
            Booking.is_deleted == False,
            func.date(Booking.created_at) == today,
            Booking.booking_status != "cancelled",
        )
    )
    today_booking_rev = Decimal(str(today_booking_rev_res.scalar() or 0))

    today_order_rev_res = await db.execute(
        select(func.coalesce(func.sum(Order.total_amount), 0)).where(
            Order.is_deleted == False,
            func.date(Order.created_at) == today,
            Order.status != "cancelled",
        )
    )
    today_order_rev = Decimal(str(today_order_rev_res.scalar() or 0))
    today_revenue = today_booking_rev + today_order_rev

    # 6. Revenue month
    month_booking_rev_res = await db.execute(
        select(func.coalesce(func.sum(Booking.total_amount), 0)).where(
            Booking.is_deleted == False,
            func.date(Booking.created_at) >= start_of_month,
            Booking.booking_status != "cancelled",
        )
    )
    month_order_rev_res = await db.execute(
        select(func.coalesce(func.sum(Order.total_amount), 0)).where(
            Order.is_deleted == False,
            func.date(Order.created_at) >= start_of_month,
            Order.status != "cancelled",
        )
    )
    month_revenue = Decimal(str(month_booking_rev_res.scalar() or 0)) + Decimal(
        str(month_order_rev_res.scalar() or 0)
    )

    return OverviewKPIs(
        today_bookings_count=today_bookings_count,
        today_check_ins=today_check_ins,
        today_check_outs=today_check_outs,
        occupancy_rate_percent=occupancy_rate,
        today_orders_count=today_orders_count,
        pending_orders_count=pending_orders_count,
        today_revenue=today_revenue,
        month_revenue=month_revenue,
    )


async def get_revenue_time_series(db: AsyncSession, days: int = 30) -> list[TimeSeriesPoint]:
    start_date = date.today() - timedelta(days=days - 1)
    points: list[TimeSeriesPoint] = []

    for i in range(days):
        current = start_date + timedelta(days=i)

        # Bookings
        b_res = await db.execute(
            select(func.coalesce(func.sum(Booking.total_amount), 0), func.count(Booking.id)).where(
                Booking.is_deleted == False,
                func.date(Booking.created_at) == current,
                Booking.booking_status != "cancelled",
            )
        )
        b_rev, b_cnt = b_res.first()

        # Orders
        o_res = await db.execute(
            select(func.coalesce(func.sum(Order.total_amount), 0), func.count(Order.id)).where(
                Order.is_deleted == False,
                func.date(Order.created_at) == current,
                Order.status != "cancelled",
            )
        )
        o_rev, o_cnt = o_res.first()

        b_rev_dec = Decimal(str(b_rev))
        o_rev_dec = Decimal(str(o_rev))

        points.append(
            TimeSeriesPoint(
                date=current.isoformat(),
                bookings_revenue=b_rev_dec,
                orders_revenue=o_rev_dec,
                total_revenue=b_rev_dec + o_rev_dec,
                bookings_count=b_cnt or 0,
                orders_count=o_cnt or 0,
            )
        )
    return points


async def get_top_dishes(db: AsyncSession, limit: int = 5) -> list[TopDish]:
    stmt = (
        select(
            OrderItem.item_name,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("qty"),
            func.coalesce(func.sum(OrderItem.total_price), 0).label("rev"),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.is_deleted == False, Order.status != "cancelled")
        .group_by(OrderItem.item_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [
        TopDish(
            name=row[0],
            category="Delicee Special",
            orders_count=row[1],
            revenue=Decimal(str(row[2])),
        )
        for row in result.all()
    ]


async def get_needs_attention(db: AsyncSession) -> list[NeedsAttentionItem]:
    items: list[NeedsAttentionItem] = []

    # 1. Pending bookings
    p_bookings = await db.execute(
        select(Booking)
        .where(Booking.is_deleted == False, Booking.booking_status == "pending")
        .order_by(Booking.created_at.asc())
        .limit(5)
    )
    for b in p_bookings.scalars().all():
        items.append(
            NeedsAttentionItem(
                type="pending_booking",
                title=f"New booking from {b.guest_name} ({b.check_in_date})",
                reference=b.booking_reference,
                entity_id=b.id,
                urgency="high",
                created_at=b.created_at.isoformat(),
            )
        )

    # 2. Pending orders
    p_orders = await db.execute(
        select(Order)
        .where(Order.is_deleted == False, Order.status == "new")
        .order_by(Order.created_at.asc())
        .limit(5)
    )
    for o in p_orders.scalars().all():
        items.append(
            NeedsAttentionItem(
                type="pending_order",
                title=f"New {o.order_type} order for Rs. {o.total_amount}",
                reference=o.order_reference,
                entity_id=o.id,
                urgency="high",
                created_at=o.created_at.isoformat(),
            )
        )

    # 3. New event enquiries
    p_enquiries = await db.execute(
        select(Enquiry)
        .where(Enquiry.is_deleted == False, Enquiry.status == "new")
        .order_by(Enquiry.created_at.asc())
        .limit(5)
    )
    for e in p_enquiries.scalars().all():
        items.append(
            NeedsAttentionItem(
                type="pending_enquiry",
                title=f"Event Enquiry ({e.event_type}) from {e.customer_name}",
                reference=e.enquiry_reference,
                entity_id=e.id,
                urgency="medium",
                created_at=e.created_at.isoformat(),
            )
        )

    return items
