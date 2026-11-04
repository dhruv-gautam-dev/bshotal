from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.sqlite import JSON as SQLITE_JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import TimeStampedModel


class MenuCategory(TimeStampedModel):
    __tablename__ = "menu_categories"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_hi: Mapped[str | None] = mapped_column(String(100), nullable=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    items = relationship(
        "MenuItem",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="MenuItem.display_order",
    )


class MenuItem(TimeStampedModel):
    __tablename__ = "menu_items"

    category_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("menu_categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    name_hi: Mapped[str | None] = mapped_column(String(150), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_veg: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    spicy_level: Mapped[int] = mapped_column(Integer, default=0)  # 0 to 3
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_bestseller: Mapped[bool] = mapped_column(Boolean, default=False)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(SQLITE_JSON, default=list)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    category = relationship("MenuCategory", back_populates="items")
    order_items = relationship("OrderItem", back_populates="menu_item")
