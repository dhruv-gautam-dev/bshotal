import logging
import mimetypes
import os
import re
import uuid
from pathlib import Path

import httpx
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

logger = logging.getLogger("bshotel.storage")

ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def sanitize_filename(name: str) -> str:
    base = Path(name).stem
    clean = re.sub(r"[^a-zA-Z0-9_\-]", "_", base)[:30]
    return clean or "upload"


class StorageService:
    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
        self.service_key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
        self.local_upload_dir = Path("static/uploads")
        self.local_upload_dir.mkdir(parents=True, exist_ok=True)

    def validate_file(self, file: UploadFile, content: bytes) -> str:
        """Validates mime type and file size. Returns extension."""
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum allowed size is 5MB. Received: {len(content) / (1024*1024):.2f}MB",
            )

        content_type = file.content_type
        if not content_type or content_type not in ALLOWED_MIME_TYPES:
            # Fallback to guessing by filename
            guessed, _ = mimetypes.guess_type(file.filename or "")
            if not guessed or guessed not in ALLOWED_MIME_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid file type '{content_type}'. Only JPEG, PNG, and WebP are allowed.",
                )
            content_type = guessed

        return ALLOWED_MIME_TYPES[content_type]

    async def upload_file(self, file: UploadFile, bucket: str = "room-photos") -> str:
        """
        Uploads file to Supabase Storage (if configured) or local storage fallback.
        Returns the public URL to access the uploaded file.
        """
        content = await file.read()
        ext = self.validate_file(file, content)
        clean_name = sanitize_filename(file.filename or "photo")
        filename = f"{clean_name}_{uuid.uuid4().hex[:12]}{ext}"

        if self.supabase_url and self.service_key:
            return await self._upload_to_supabase(content, bucket, filename, file.content_type or "image/jpeg")
        else:
            return await self._upload_to_local(content, bucket, filename)

    async def _upload_to_supabase(self, content: bytes, bucket: str, filename: str, content_type: str) -> str:
        url = f"{self.supabase_url}/storage/v1/object/{bucket}/{filename}"
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": content_type,
            "x-upsert": "true",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(url, headers=headers, content=content)
                if response.status_code not in (200, 201):
                    logger.error(
                        "Supabase storage upload error [%s]: %s", response.status_code, response.text
                    )
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=f"Storage upload failed: {response.text}",
                    )

                # Return public CDN URL
                public_url = f"{self.supabase_url}/storage/v1/object/public/{bucket}/{filename}"
                logger.info("Uploaded to Supabase Storage: %s", public_url)
                return public_url
            except httpx.RequestError as exc:
                logger.error("Supabase Storage connection error: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Could not reach Supabase Storage service.",
                )

    async def _upload_to_local(self, content: bytes, bucket: str, filename: str) -> str:
        bucket_dir = self.local_upload_dir / bucket
        bucket_dir.mkdir(parents=True, exist_ok=True)
        file_path = bucket_dir / filename
        file_path.write_bytes(content)
        logger.info("Saved file locally at: %s", file_path)
        return f"/static/uploads/{bucket}/{filename}"

    async def delete_file(self, bucket: str, filename: str) -> bool:
        if self.supabase_url and self.service_key:
            url = f"{self.supabase_url}/storage/v1/object/{bucket}"
            headers = {
                "Authorization": f"Bearer {self.service_key}",
                "Content-Type": "application/json",
            }
            payload = {"prefixes": [filename]}
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.request("DELETE", url, headers=headers, json=payload)
                return resp.status_code in (200, 204)
        else:
            local_path = self.local_upload_dir / bucket / filename
            if local_path.exists():
                local_path.unlink()
                return True
            return False


storage_service = StorageService()

