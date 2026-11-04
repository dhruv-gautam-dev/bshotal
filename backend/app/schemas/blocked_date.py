from datetime import date

from app.schemas.common import BaseSchema


class BlockedDateBase(BaseSchema):
    room_type_id: str | None = None
    start_date: date
    end_date: date
    reason: str
    notes: str | None = None


class BlockedDateCreate(BlockedDateBase):
    pass


class BlockedDateUpdate(BaseSchema):
    room_type_id: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    reason: str | None = None
    notes: str | None = None


class BlockedDateOut(BlockedDateBase):
    id: str
