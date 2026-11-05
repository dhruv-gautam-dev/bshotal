from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_manager, require_staff
from app.models.enquiry import Enquiry
from app.models.event_package import EventPackage
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.enquiry import EnquiryOut, EnquiryUpdateAdmin
from app.schemas.event_package import EventPackageCreate, EventPackageOut, EventPackageUpdate
from app.utils.pagination import paginate_list

router = APIRouter(prefix="/enquiries", tags=["Admin Enquiries"])


@router.get("", response_model=PaginatedResponse[EnquiryOut])
async def list_enquiries(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    status_filter: str | None = Query(None, alias="status"),
    event_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    stmt = select(Enquiry).where(Enquiry.is_deleted == False).order_by(Enquiry.created_at.desc())
    if status_filter:
        stmt = stmt.where(Enquiry.status == status_filter)
    if event_type:
        stmt = stmt.where(Enquiry.event_type == event_type)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    items = (await db.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()
    return paginate_list(items, total, page, limit)


@router.put("/{enquiry_id}", response_model=EnquiryOut)
async def update_enquiry(
    enquiry_id: str,
    data: EnquiryUpdateAdmin,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry or enquiry.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enquiry not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(enquiry, k, v)

    await db.commit()
    await db.refresh(enquiry)
    return enquiry


@router.delete("/{enquiry_id}", response_model=MessageResponse)
async def delete_enquiry(
    enquiry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enquiry not found")
    enquiry.is_deleted = True
    await db.commit()
    return MessageResponse(message="Enquiry deleted")


# --- Event Packages CRUD ---
@router.get("/packages", response_model=list[EventPackageOut])
async def list_admin_event_packages(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    stmt = (
        select(EventPackage)
        .where(EventPackage.is_deleted == False)
        .order_by(EventPackage.display_order.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/packages", response_model=EventPackageOut)
async def create_admin_event_package(
    data: EventPackageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    pkg = EventPackage(**data.model_dump())
    db.add(pkg)
    await db.commit()
    await db.refresh(pkg)
    return pkg


@router.put("/packages/{package_id}", response_model=EventPackageOut)
async def update_admin_event_package(
    package_id: str,
    data: EventPackageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    pkg = await db.get(EventPackage, package_id)
    if not pkg or pkg.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(pkg, k, v)
    await db.commit()
    await db.refresh(pkg)
    return pkg


@router.delete("/packages/{package_id}", response_model=MessageResponse)
async def delete_admin_event_package(
    package_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    pkg = await db.get(EventPackage, package_id)
    if not pkg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    pkg.is_deleted = True
    await db.commit()
    return MessageResponse(message="Package deleted")

