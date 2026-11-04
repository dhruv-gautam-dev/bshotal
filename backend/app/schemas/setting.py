from decimal import Decimal

from pydantic import EmailStr

from app.schemas.common import BaseSchema


class SettingBase(BaseSchema):
    hotel_name: str
    restaurant_name: str
    tagline: str
    bookings_phone: str
    payments_phone: str
    whatsapp_number: str
    email: EmailStr
    address: str
    city: str
    state: str
    pincode: str
    google_maps_url: str | None = None
    gstin: str | None = None
    fssai_license: str | None = None
    check_in_time: str
    check_out_time: str
    room_tax_percent: Decimal
    restaurant_tax_percent: Decimal
    delivery_charge: Decimal
    free_delivery_above: Decimal
    min_delivery_order: Decimal
    is_online_ordering_enabled: bool
    is_room_booking_enabled: bool
    cancellation_policy: str | None = None
    house_rules: str | None = None


class SettingUpdate(BaseSchema):
    hotel_name: str | None = None
    restaurant_name: str | None = None
    tagline: str | None = None
    bookings_phone: str | None = None
    payments_phone: str | None = None
    whatsapp_number: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    google_maps_url: str | None = None
    gstin: str | None = None
    fssai_license: str | None = None
    check_in_time: str | None = None
    check_out_time: str | None = None
    room_tax_percent: Decimal | None = None
    restaurant_tax_percent: Decimal | None = None
    delivery_charge: Decimal | None = None
    free_delivery_above: Decimal | None = None
    min_delivery_order: Decimal | None = None
    is_online_ordering_enabled: bool | None = None
    is_room_booking_enabled: bool | None = None
    cancellation_policy: str | None = None
    house_rules: str | None = None


class SettingOut(SettingBase):
    id: str
