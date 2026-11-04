from decimal import Decimal

from pydantic import Field

from app.schemas.common import BaseSchema


class MenuItemBase(BaseSchema):
    category_id: str
    name: str
    name_hi: str | None = None
    description: str | None = None
    price: Decimal
    is_veg: bool = True
    spicy_level: int = Field(0, ge=0, le=3)
    is_available: bool = True
    is_bestseller: bool = False
    image_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    display_order: int = 0


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemUpdate(BaseSchema):
    category_id: str | None = None
    name: str | None = None
    name_hi: str | None = None
    description: str | None = None
    price: Decimal | None = None
    is_veg: bool | None = None
    spicy_level: int | None = Field(None, ge=0, le=3)
    is_available: bool | None = None
    is_bestseller: bool | None = None
    image_url: str | None = None
    tags: list[str] | None = None
    display_order: int | None = None


class MenuItemOut(MenuItemBase):
    id: str


class MenuCategoryBase(BaseSchema):
    name: str
    name_hi: str | None = None
    slug: str
    description: str | None = None
    display_order: int = 0
    is_active: bool = True


class MenuCategoryCreate(MenuCategoryBase):
    pass


class MenuCategoryUpdate(BaseSchema):
    name: str | None = None
    name_hi: str | None = None
    slug: str | None = None
    description: str | None = None
    display_order: int | None = None
    is_active: bool | None = None


class MenuCategoryOut(MenuCategoryBase):
    id: str
    items: list[MenuItemOut] = Field(default_factory=list)


class BulkPriceUpdate(BaseSchema):
    category_id: str | None = None  # None means all categories
    update_type: str = Field(..., pattern="^(percentage|fixed)$")
    value: Decimal  # e.g. 10.0 for 10% increase or 20.0 for Rs 20 increase
