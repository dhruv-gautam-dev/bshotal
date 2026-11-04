from datetime import datetime
from typing import Any

from app.schemas.common import BaseSchema


class AuditLogOut(BaseSchema):
    id: str
    user_id: str | None = None
    user_name: str | None = None
    user_role: str | None = None
    action: str
    entity_type: str
    entity_id: str
    details: dict[str, Any]
    ip_address: str | None = None
    created_at: datetime
