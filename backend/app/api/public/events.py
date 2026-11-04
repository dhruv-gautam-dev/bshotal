import random
import string
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.enquiry import Enquiry
from app.models.event_package import EventPackage
from app.schemas.common import MessageResponse
from app.schemas.enquiry import EnquiryCreatePublic
from app.schemas.event_package import EventPackageOut
from app.services.booking_service import get_or_create_customer
from app.services.notification_service import create_notification

router = APIRouter(prefix="/events", tags=["Public Events & Enquiries"])


def generate_enquiry_reference() -> str:
    year = datetime.now(UTC).year
    rand_chars = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"ENQ-{year}-{rand_chars}"


@router.get("/packages", response_model=list[EventPackageOut])
async def get_public_event_packages(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(EventPackage)
        .where(EventPackage.is_active == True, EventPackage.is_deleted == False)
        .order_by(EventPackage.display_order.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/enquiry", response_model=MessageResponse)
async def submit_public_enquiry(
    enquiry_in: EnquiryCreatePublic, db: AsyncSession = Depends(get_db)
):
    if enquiry_in.honeypot:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request")

    await get_or_create_customer(
        db,
        phone=enquiry_in.customer_phone,
        name=enquiry_in.customer_name,
        email=enquiry_in.customer_email,
    )

    enquiry = Enquiry(
        enquiry_reference=generate_enquiry_reference(),
        customer_name=enquiry_in.customer_name,
        customer_phone=enquiry_in.customer_phone,
        customer_email=enquiry_in.customer_email,
        event_type=enquiry_in.event_type,
        event_date=enquiry_in.event_date,
        guest_count=enquiry_in.guest_count,
        budget=enquiry_in.budget,
        message=enquiry_in.message,
        status="new",
    )
    db.add(enquiry)
    await db.commit()

    await create_notification(
        db,
        title=f"New Event Enquiry ({enquiry.event_type.upper()})",
        message=f"{enquiry.customer_name} submitted inquiry for {enquiry.event_date or 'upcoming event'} ({enquiry.customer_phone})",
        category="enquiry",
        reference_id=enquiry.id,
    )

    return MessageResponse(
        message=f"Thank you {enquiry_in.customer_name}. Your enquiry #{enquiry.enquiry_reference} has been received. Our event coordinator will contact you shortly."
    )
