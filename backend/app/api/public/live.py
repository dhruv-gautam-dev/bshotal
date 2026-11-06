import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.services.notification_service import broadcaster

router = APIRouter(prefix="/live", tags=["Public Live Stream"])


@router.get("/stream")
async def public_live_stream(request: Request):
    """
    Public Server-Sent Events (SSE) live stream.
    Broadcasts real-time events (menu updates, price changes, room availability, order updates)
    to all connected customer and staff devices with periodic keep-alive pings.
    """
    queue = await broadcaster.subscribe()

    async def event_generator():
        try:
            # Initial connection confirmation
            yield f"event: connected\ndata: {json.dumps({'status': 'connected'})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for message with 15s timeout for keep-alive ping
                    payload = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield payload
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat ping to prevent timeouts
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

