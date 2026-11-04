from decimal import Decimal

from app.schemas.common import BaseSchema


class OverviewKPIs(BaseSchema):
    today_bookings_count: int
    today_check_ins: int
    today_check_outs: int
    occupancy_rate_percent: float
    today_orders_count: int
    pending_orders_count: int
    today_revenue: Decimal
    month_revenue: Decimal


class TimeSeriesPoint(BaseSchema):
    date: str
    bookings_revenue: Decimal
    orders_revenue: Decimal
    total_revenue: Decimal
    bookings_count: int
    orders_count: int


class TopDish(BaseSchema):
    name: str
    category: str
    orders_count: int
    revenue: Decimal


class RoomTypeOccupancy(BaseSchema):
    room_type_id: str
    room_type_name: str
    bookings_count: int
    revenue: Decimal


class NeedsAttentionItem(BaseSchema):
    type: str  # pending_booking, pending_order, pending_enquiry, unassigned_room
    title: str
    reference: str
    entity_id: str
    urgency: str  # high, medium, low
    created_at: str
