from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

from app.core.deps import require_staff
from app.models.user import User
from app.services.storage_service import storage_service

router = APIRouter(prefix="/uploads", tags=["Admin File Uploads"])


class UploadResponse(BaseModel):
    url: str
    filename: str
    bucket: str


@router.post("", response_model=UploadResponse)
async def upload_image(
    file: UploadFile = File(...),
    bucket: str = Form("room-photos"),
    current_user: User = Depends(require_staff),
):
    """Uploads an image (room photo, menu item image, gallery) to Supabase Storage."""
    # Ensure allowed bucket name
    allowed_buckets = {"room-photos", "menu-photos", "gallery", "invoices"}
    target_bucket = bucket if bucket in allowed_buckets else "room-photos"

    public_url = await storage_service.upload_file(file=file, bucket=target_bucket)
    return UploadResponse(
        url=public_url,
        filename=file.filename or "uploaded_image",
        bucket=target_bucket,
    )

