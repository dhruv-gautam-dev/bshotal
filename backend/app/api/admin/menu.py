import csv
import io
from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, require_manager, require_staff
from app.models.menu import MenuCategory, MenuItem
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.menu import (
    BulkPriceUpdate,
    MenuCategoryCreate,
    MenuCategoryOut,
    MenuCategoryUpdate,
    MenuItemCreate,
    MenuItemOut,
    MenuItemUpdate,
)
from app.services.audit_service import log_audit_event
from app.services.notification_service import broadcaster

router = APIRouter(prefix="/menu", tags=["Admin Menu Management"])


# --- Categories ---
@router.get("/categories", response_model=list[MenuCategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    stmt = (
        select(MenuCategory)
        .where(MenuCategory.is_deleted == False)
        .options(selectinload(MenuCategory.items.and_(MenuItem.is_deleted == False)))
        .order_by(MenuCategory.display_order.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/categories", response_model=MenuCategoryOut)
async def create_category(
    data: MenuCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    cat = MenuCategory(**data.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    await broadcaster.broadcast("menu_updated", {"action": "create_category", "id": cat.id})
    return cat


@router.put("/categories/{category_id}", response_model=MenuCategoryOut)
async def update_category(
    category_id: str,
    data: MenuCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    cat = await db.get(MenuCategory, category_id)
    if not cat or cat.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    await db.commit()
    await db.refresh(cat)
    await broadcaster.broadcast("menu_updated", {"action": "update_category", "id": cat.id})
    return cat


@router.delete("/categories/{category_id}", response_model=MessageResponse)
async def delete_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    cat = await db.get(MenuCategory, category_id)
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    cat.is_deleted = True
    await db.commit()
    await broadcaster.broadcast("menu_updated", {"action": "delete_category", "id": category_id})
    return MessageResponse(message="Category deleted")


# --- Items ---
@router.get("/items", response_model=list[MenuItemOut])
async def list_items(
    category_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = (
        select(MenuItem).where(MenuItem.is_deleted == False).order_by(MenuItem.display_order.asc())
    )
    if category_id:
        stmt = stmt.where(MenuItem.category_id == category_id)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/items", response_model=MenuItemOut)
async def create_menu_item(
    data: MenuItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    item = MenuItem(**data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    await broadcaster.broadcast("menu_updated", {"action": "create_item", "id": item.id, "price": str(item.price)})
    return item


@router.put("/items/{item_id}", response_model=MenuItemOut)
async def update_menu_item(
    item_id: str,
    data: MenuItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),  # Staff can toggle is_available
):
    item = await db.get(MenuItem, item_id)
    if not item or item.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")

    if current_user.role == "staff":
        if data.is_available is not None:
            item.is_available = data.is_available
    else:
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(item, k, v)

    await db.commit()
    await db.refresh(item)
    await broadcaster.broadcast("menu_updated", {"action": "update_item", "id": item.id, "price": str(item.price), "is_available": item.is_available})
    return item


@router.delete("/items/{item_id}", response_model=MessageResponse)
async def delete_menu_item(
    item_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_manager)
):
    item = await db.get(MenuItem, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")
    item.is_deleted = True
    await db.commit()
    await broadcaster.broadcast("menu_updated", {"action": "delete_item", "id": item_id})
    return MessageResponse(message="Menu item deleted")


# --- Bulk Price Update ---
@router.post("/bulk-price-update", response_model=MessageResponse)
async def bulk_update_prices(
    data: BulkPriceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    stmt = select(MenuItem).where(MenuItem.is_deleted == False)
    if data.category_id:
        stmt = stmt.where(MenuItem.category_id == data.category_id)
    res = await db.execute(stmt)
    items = res.scalars().all()

    for it in items:
        if data.update_type == "percentage":
            multiplier = Decimal(1) + (data.value / Decimal(100))
            it.price = (it.price * multiplier).quantize(Decimal("1.00"), rounding=ROUND_HALF_UP)
        elif data.update_type == "fixed":
            it.price = max(Decimal("0.00"), (it.price + data.value).quantize(Decimal("1.00")))

    await db.commit()
    await broadcaster.broadcast("menu_updated", {"action": "bulk_price_update"})
    await log_audit_event(
        db,
        action="bulk_price_update",
        entity_type="menu",
        entity_id=data.category_id or "all",
        details=data.model_dump(),
        user=current_user,
    )
    return MessageResponse(message=f"Successfully updated prices for {len(items)} items")


# --- CSV Import & Export ---
@router.get("/export")
async def export_menu_csv(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    stmt = (
        select(MenuItem, MenuCategory.name.label("category_name"))
        .join(MenuCategory, MenuCategory.id == MenuItem.category_id)
        .where(MenuItem.is_deleted == False)
        .order_by(MenuCategory.name.asc(), MenuItem.name.asc())
    )
    res = await db.execute(stmt)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        ["Category", "Name", "Hindi Name", "Price", "Available", "Bestseller", "Description"]
    )

    for item, cat_name in res.all():
        writer.writerow(
            [
                cat_name,
                item.name,
                item.name_hi or "",
                f"{item.price:.2f}",
                item.is_available,
                item.is_bestseller,
                item.description or "",
            ]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=delicee_menu.csv"},
    )
