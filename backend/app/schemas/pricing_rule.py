from datetime import date
from decimal import Decimal

from pydantic import Field

from app.schemas.common import BaseSchema


class PricingRuleBase(BaseSchema):
    room_type_id: str | None = None
    label: str
    start_date: date
    end_date: date
    rule_type: str = Field(
        "override_price", pattern="^(override_price|percentage_adjustment|fixed_adjustment)$"
    )
    price: Decimal
    days_of_week: list[int] = Field(default_factory=list)
    is_active: bool = True


class PricingRuleCreate(PricingRuleBase):
    pass


class PricingRuleUpdate(BaseSchema):
    room_type_id: str | None = None
    label: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    rule_type: str | None = Field(
        None, pattern="^(override_price|percentage_adjustment|fixed_adjustment)$"
    )
    price: Decimal | None = None
    days_of_week: list[int] | None = None
    is_active: bool | None = None


class PricingRuleOut(PricingRuleBase):
    id: str
