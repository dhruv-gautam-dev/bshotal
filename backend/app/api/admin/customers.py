from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_manager, require_staff
from app.models.customer import Customer
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.customer import CustomerOut, CustomerUpdate
from app.utils.pagination import paginate_list

router = APIRouter(prefix="/customers", tags=["Admin Customers"])


@router.get("", response_model=PaginatedResponse[CustomerOut])
async def list_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    is_vip: bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = select(Customer).where(Customer.is_deleted == False).order_by(Customer.created_at.desc())
    if is_vip is not None:
        stmt = stmt.where(Customer.is_vip == is_vip)
    if search:
        search_fmt = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Customer.name.ilike(search_fmt),
                Customer.phone.ilike(search_fmt),
                Customer.email.ilike(search_fmt),
            )
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    items = (await db.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()
    return paginate_list(items, total, page, limit)


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer_detail(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    customer = await db.get(Customer, customer_id)
    if not customer or customer.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    customer = await db.get(Customer, customer_id)
    if not customer or customer.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(customer, k, v)

    await db.commit()
    await db.refresh(customer)
    return customer
