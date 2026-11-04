from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pricing_rule import PricingRule
from app.models.room_type import RoomType
from app.models.setting import Setting
from app.schemas.room_type import DailyPriceBreakdown


async def get_active_pricing_rules(
    db: AsyncSession, room_type_id: str | None, start_date: date, end_date: date
) -> list[PricingRule]:
    """Fetches all active pricing rules that overlap with the date window."""
    stmt = select(PricingRule).where(
        PricingRule.is_active == True,
        PricingRule.is_deleted == False,
        PricingRule.start_date <= end_date,
        PricingRule.end_date >= start_date,
    )
    result = await db.execute(stmt)
    rules = list(result.scalars().all())

    # Filter for rules specific to this room type or global (room_type_id is None)
    return [r for r in rules if r.room_type_id is None or r.room_type_id == room_type_id]


async def calculate_room_pricing(
    db: AsyncSession, room_type: RoomType, check_in: date, check_out: date, num_rooms: int = 1
) -> tuple[list[DailyPriceBreakdown], Decimal, Decimal, Decimal, Decimal]:
    """
    Computes daily rate for each night between check_in and check_out.
    Returns: (daily_rates, base_amount, tax_percent, tax_amount, total_amount)
    """
    # Fetch settings for tax
    setting_res = await db.execute(select(Setting).limit(1))
    setting = setting_res.scalar_one_or_none()
    tax_percent = setting.room_tax_percent if setting else Decimal("12.00")

    rules = await get_active_pricing_rules(db, room_type.id, check_in, check_out)

    daily_rates: list[DailyPriceBreakdown] = []
    base_total = Decimal("0.00")

    current_date = check_in
    while current_date < check_out:
        rate = Decimal(str(room_type.base_price))
        rule_label: str | None = None

        # Check pricing rules for current_date (most specific rule first)
        day_of_week = current_date.weekday()  # 0=Mon, 6=Sun
        matching_rules = [
            r
            for r in rules
            if r.start_date <= current_date <= r.end_date
            and (not r.days_of_week or day_of_week in r.days_of_week)
        ]

        if matching_rules:
            # Prefer room_type specific rule over global rule
            best_rule = next(
                (r for r in matching_rules if r.room_type_id == room_type.id), matching_rules[0]
            )
            rule_label = best_rule.label
            if best_rule.rule_type == "override_price":
                rate = Decimal(str(best_rule.price))
            elif best_rule.rule_type == "percentage_adjustment":
                rate = rate * (Decimal(1) + (Decimal(str(best_rule.price)) / Decimal(100)))
            elif best_rule.rule_type == "fixed_adjustment":
                rate = rate + Decimal(str(best_rule.price))

        rate = rate.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        daily_rates.append(
            DailyPriceBreakdown(date=current_date, rate=rate, rule_applied=rule_label)
        )
        base_total += rate
        current_date += timedelta(days=1)

    base_amount = (base_total * num_rooms).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    tax_amount = (base_amount * (tax_percent / Decimal(100))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total_amount = base_amount + tax_amount

    return daily_rates, base_amount, tax_percent, tax_amount, total_amount
