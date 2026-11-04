from decimal import Decimal

from pydantic import Field

from app.schemas.common import BaseSchema


class EventPackageBase(BaseSchema):
    name: str
    slug: str
    description: str
    price_per_plate: Decimal
    min_guests: int = 50
    max_guests: int = 500
    features: list[str] = Field(default_factory=list)
    display_order: int = 0
    is_active: bool = True


class EventPackageCreate(EventPackageBase):
    pass


class EventPackageUpdate(BaseSchema):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    price_per_plate: Decimal | None = None
    min_guests: int | None = None
    max_guests: int | None = None
    features: list[str] | None = None
    display_order: int | None = None
    is_active: bool | None = None


class EventPackageOut(EventPackageBase):
    id: str
