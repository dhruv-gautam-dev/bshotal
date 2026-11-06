from fastapi import APIRouter

from app.api.public.bookings import router as bookings_router
from app.api.public.events import router as events_router
from app.api.public.live import router as live_router
from app.api.public.menu import router as menu_router
from app.api.public.orders import router as orders_router
from app.api.public.reviews import router as reviews_router
from app.api.public.rooms import router as rooms_router
from app.api.public.settings import router as settings_router

router = APIRouter(prefix="/public", tags=["Public"])

router.include_router(settings_router)
router.include_router(rooms_router)
router.include_router(bookings_router)
router.include_router(menu_router)
router.include_router(orders_router)
router.include_router(events_router)
router.include_router(reviews_router)
router.include_router(live_router)
