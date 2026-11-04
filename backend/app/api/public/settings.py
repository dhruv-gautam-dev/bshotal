from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.models.setting import Setting
from app.schemas.setting import SettingOut

router = APIRouter(prefix="/settings", tags=["Public Settings"])


@router.get("", response_model=SettingOut)
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Setting).limit(1))
    setting = res.scalar_one_or_none()
    if not setting:
        setting = Setting()
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    return setting
