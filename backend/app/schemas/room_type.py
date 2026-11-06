from datetime import date
from decimal import Decimal
from typing import Any

from pydantic import Field, model_validator

from app.schemas.common import BaseSchema


class RoomTypeBase(BaseSchema):
    name: str
    slug: str
    description: str
    base_price: Decimal
    max_guests: int = 2
    bed_type: str = "King Bed"
    size_sqft: int | None = None
    amenities: list[str] = Field(default_factory=list)
    images: list[str] = Field(default_factory=list)
    total_inventory: int = 1
    total_rooms: int = 1
    display_order: int = 0
    is_active: bool = True

    @model_validator(mode="before")
    @classmethod
    def sync_total_inventory(cls, values: Any) -> Any:
        if isinstance(values, dict):
            if "total_rooms" in values and ("total_inventory" not in values or values.get("total_inventory") is None):
                values["total_inventory"] = values["total_rooms"]
            elif "total_inventory" in values and ("total_rooms" not in values or values.get("total_rooms") is None):
                values["total_rooms"] = values["total_inventory"]
        return values


class RoomTypeCreate(RoomTypeBase):
    pass


class RoomTypeUpdate(BaseSchema):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    base_price: Decimal | None = None
    max_guests: int | None = None
    bed_type: str | None = None
    size_sqft: int | None = None
    amenities: list[str] | None = None
    images: list[str] | None = None
    total_inventory: int | None = None
    total_rooms: int | None = None
    display_order: int | None = None
    is_active: bool | None = None

    @model_validator(mode="before")
    @classmethod
    def sync_update_inventory(cls, values: Any) -> Any:
        if isinstance(values, dict):
            if "total_rooms" in values and ("total_inventory" not in values or values.get("total_inventory") is None):
                values["total_inventory"] = values["total_rooms"]
            elif "total_inventory" in values and ("total_rooms" not in values or values.get("total_rooms") is None):
                values["total_rooms"] = values["total_inventory"]
        return values


class RoomTypeOut(RoomTypeBase):
    id: str


class AvailabilityQuery(BaseSchema):
    check_in: date
    check_out: date
    guests: int = 1
    rooms: int = 1


class DailyPriceBreakdown(BaseSchema):
    date: date
    rate: Decimal
    rule_applied: str | None = None


class RoomTypeQuote(BaseSchema):
    room_type_id: str
    name: str
    slug: str
    bed_type: str
    max_guests: int
    images: list[str]
    amenities: list[str]
    available_rooms: int
    is_available: bool
    nights: int
    daily_rates: list[DailyPriceBreakdown]
    base_amount: Decimal
    tax_percent: Decimal
    tax_amount: Decimal
    total_amount: Decimal
