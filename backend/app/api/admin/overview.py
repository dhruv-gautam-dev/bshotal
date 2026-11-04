from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_staff
from app.models.user import User
from app.schemas.reports import NeedsAttentionItem, OverviewKPIs, TimeSeriesPoint, TopDish
from app.services.reports_service import (
    get_needs_attention,
    get_overview_kpis,
    get_revenue_time_series,
    get_top_dishes,
)

router = APIRouter(prefix="/overview", tags=["Admin Overview"])


@router.get("/kpis", response_model=OverviewKPIs)
async def get_dashboard_kpis(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    return await get_overview_kpis(db)


@router.get("/charts", response_model=list[TimeSeriesPoint])
async def get_dashboard_charts(
    days: int = Query(30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    return await get_revenue_time_series(db, days=days)


@router.get("/top-dishes", response_model=list[TopDish])
async def get_dashboard_top_dishes(
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    return await get_top_dishes(db, limit=limit)


@router.get("/needs-attention", response_model=list[NeedsAttentionItem])
async def get_dashboard_needs_attention(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    return await get_needs_attention(db)
