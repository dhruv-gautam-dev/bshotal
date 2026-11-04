from fastapi import APIRouter

from app.api.admin.audit import router as audit_router
from app.api.admin.bookings import router as bookings_router
from app.api.admin.customers import router as customers_router
from app.api.admin.enquiries import router as enquiries_router
from app.api.admin.menu import router as menu_router
from app.api.admin.notifications import router as notifications_router
from app.api.admin.orders import router as orders_router
from app.api.admin.overview import router as overview_router
from app.api.admin.payments import router as payments_router
from app.api.admin.reports import router as reports_router
from app.api.admin.reviews import router as reviews_router
from app.api.admin.rooms import router as rooms_router
from app.api.admin.settings import router as settings_router
from app.api.admin.staff import router as staff_router

router = APIRouter(prefix="/admin", tags=["Admin"])

router.include_router(overview_router)
router.include_router(bookings_router)
router.include_router(rooms_router)
router.include_router(orders_router)
router.include_router(menu_router)
router.include_router(enquiries_router)
router.include_router(reviews_router)
router.include_router(customers_router)
router.include_router(payments_router)
router.include_router(reports_router)
router.include_router(settings_router)
router.include_router(staff_router)
router.include_router(audit_router)
router.include_router(notifications_router)
