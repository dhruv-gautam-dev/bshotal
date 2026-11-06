from decimal import Decimal

from sqlalchemy import Boolean, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import TimeStampedModel


class Setting(TimeStampedModel):
    __tablename__ = "settings"

    hotel_name: Mapped[str] = mapped_column(String(100), default="B.S. Hotel & Restaurant")
    restaurant_name: Mapped[str] = mapped_column(String(100), default="Delicee Restaurant")
    tagline: Mapped[str] = mapped_column(
        String(255), default="Pure Vegetarian Comfort & Dining on NH-2"
    )

    bookings_phone: Mapped[str] = mapped_column(String(20), default="+919149224039")
    payments_phone: Mapped[str] = mapped_column(String(20), default="+919259273735")
    whatsapp_number: Mapped[str] = mapped_column(String(20), default="+919149224039")
    email: Mapped[str] = mapped_column(String(100), default="info@bshotel.in")

    @property
    def enquiries_phone(self) -> str:
        return self.payments_phone

    @enquiries_phone.setter
    def enquiries_phone(self, val: str):
        self.payments_phone = val

    address: Mapped[str] = mapped_column(
        String(255), default="Near Township Nagar, NH-2, Mathura, Uttar Pradesh"
    )
    city: Mapped[str] = mapped_column(String(50), default="Mathura")
    state: Mapped[str] = mapped_column(String(50), default="Uttar Pradesh")
    pincode: Mapped[str] = mapped_column(String(10), default="281006")
    google_maps_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    fssai_license: Mapped[str | None] = mapped_column(String(30), nullable=True)

    check_in_time: Mapped[str] = mapped_column(String(10), default="12:00 PM")
    check_out_time: Mapped[str] = mapped_column(String(10), default="11:00 AM")

    room_tax_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("12.00"))
    restaurant_tax_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("5.00"))
    delivery_charge: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("40.00"))
    free_delivery_above: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("499.00"))
    min_delivery_order: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("199.00"))

    is_online_ordering_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    is_room_booking_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    cancellation_policy: Mapped[str | None] = mapped_column(
        Text, default="Free cancellation up to 24 hours before check-in. Non-refundable thereafter."
    )
    house_rules: Mapped[str | None] = mapped_column(
        Text,
        default="Strictly pure vegetarian property. Government-issued photo ID required at check-in.",
    )
