from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_owner, require_staff
from app.models.setting import Setting
from app.models.user import User
from app.schemas.setting import SettingOut, SettingUpdate
from app.services.audit_service import log_audit_event
from app.services.notification_service import broadcaster

router = APIRouter(prefix="/settings", tags=["Admin Settings"])


@router.get("", response_model=SettingOut)
async def get_admin_settings(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_staff)
):
    res = await db.execute(select(Setting).limit(1))
    setting = res.scalar_one_or_none()
    if not setting:
        setting = Setting()
        db.add(setting)
        await db.commit()
        await db.refresh(setting)
    return setting


@router.put("", response_model=SettingOut)
async def update_admin_settings(
    data: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    res = await db.execute(select(Setting).limit(1))
    setting = res.scalar_one_or_none()
    if not setting:
        setting = Setting()
        db.add(setting)

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(setting, k, v)

    await db.commit()
    await db.refresh(setting)

    await broadcaster.broadcast("settings_updated", {"action": "update"})

    await log_audit_event(
        db,
        action="update",
        entity_type="settings",
        entity_id=setting.id,
        details=data.model_dump(exclude_unset=True),
        user=current_user,
    )
    return setting
