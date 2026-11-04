from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db
from app.models.menu import MenuCategory, MenuItem
from app.schemas.menu import MenuCategoryOut

router = APIRouter(prefix="/menu", tags=["Public Menu"])


@router.get("", response_model=list[MenuCategoryOut])
async def get_public_menu(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(MenuCategory)
        .where(MenuCategory.is_active == True, MenuCategory.is_deleted == False)
        .options(
            selectinload(
                MenuCategory.items.and_(MenuItem.is_available == True, MenuItem.is_deleted == False)
            )
        )
        .order_by(MenuCategory.display_order.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()
