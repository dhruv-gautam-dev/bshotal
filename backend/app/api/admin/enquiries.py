from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_manager, require_staff
from app.models.enquiry import Enquiry
from app.models.user import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.enquiry import EnquiryOut, EnquiryUpdateAdmin
from app.utils.pagination import paginate_list

router = APIRouter(prefix="/enquiries", tags=["Admin Enquiries"])


@router.get("", response_model=PaginatedResponse[EnquiryOut])
async def list_enquiries(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
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
