from pydantic import Field

from app.schemas.common import BaseSchema


class RoomBase(BaseSchema):
    room_number: str
    room_type_id: str
    floor: int = 1
    status: str = Field("available", pattern="^(available|occupied|cleaning|maintenance)$")
    notes: str | None = None
    is_active: bool = True


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseSchema):
    room_number: str | None = None
    room_type_id: str | None = None
    floor: int | None = None
    status: str | None = Field(None, pattern="^(available|occupied|cleaning|maintenance)$")
    notes: str | None = None
    is_active: bool | None = None


class RoomOut(RoomBase):
    id: str
