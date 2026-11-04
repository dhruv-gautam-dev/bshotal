import asyncio
import json
import urllib.parse

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.notification import Notification


class NotificationBroadcaster:
    """Manages active SSE connections for live order and notification streaming."""

    def __init__(self):
        self._subscribers: set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._subscribers.discard(q)

    async def broadcast(self, event_type: str, data: dict):
        payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
        dead_queues = set()
        for q in self._subscribers:
            try:
                q.put_nowait(payload)
            except Exception:
                dead_queues.add(q)
        for q in dead_queues:
            self._subscribers.discard(q)


broadcaster = NotificationBroadcaster()


async def create_notification(
    db: AsyncSession,
    title: str,
    message: str,
    category: str = "system",
    reference_id: str | None = None,
    for_role: str | None = None,
) -> Notification:
    notif = Notification(
        title=title,
        message=message,
        category=category,
        reference_id=reference_id,
        for_role=for_role,
    )
    db.add(notif)
    try:
        await db.commit()
        await db.refresh(notif)
        # Broadcast to live streams
        await broadcaster.broadcast(
            "new_notification",
            {
                "id": notif.id,
                "title": notif.title,
                "message": notif.message,
                "category": notif.category,
                "reference_id": notif.reference_id,
                "created_at": notif.created_at.isoformat(),
            },
        )
    except Exception:
        await db.rollback()
    return notif


def build_whatsapp_booking_url(
    guest_name: str,
    booking_reference: str,
    room_type_name: str,
    check_in: str,
    check_out: str,
    total_amount: str,
) -> str:
    """Matches the exact WhatsApp link pattern expected by the frontend."""
    phone = settings.HOTEL_BOOKINGS_PHONE.replace("+", "").replace(" ", "").replace("-", "")
    text = (
        f"Namaste B.S. Hotel & Restaurant,\n\n"
        f"I have placed a booking request via website.\n"
        f"*Reference:* {booking_reference}\n"
        f"*Guest:* {guest_name}\n"
        f"*Room:* {room_type_name}\n"
        f"*Dates:* {check_in} to {check_out}\n"
        f"*Total:* Rs. {total_amount}\n\n"
        f"Please confirm availability and share payment details. Thank you!"
    )
    return f"https://wa.me/{phone}?text={urllib.parse.quote(text)}"
