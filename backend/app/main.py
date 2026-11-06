import json
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.customer_auth import router as customer_auth_router
from app.api.public import router as public_router
from app.core.config import settings
from app.core.deps import get_db
from app.core.logging import RequestIDMiddleware, setup_logging
from app.core.rate_limit import limiter
from app.db.base import Base
from app.db.session import engine

logger = logging.getLogger("bshotel.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Setup structured logging
    setup_logging()

    # In local SQLite development mode only, auto-create tables for convenience.
    # In production and PostgreSQL environments, schema is managed strictly via Alembic migrations.
    if settings.APP_ENV == "development" and "sqlite" in settings.DATABASE_URL:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("[DB] Local SQLite tables initialized.")

    # Boot-time database readiness check
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("[DB] Database connectivity check PASSED successfully.")
    except Exception as exc:
        logger.error("[DB ERROR] Database connection failed on boot: %s", type(exc).__name__)
        if settings.APP_ENV == "production":
            logger.critical("[DB CRITICAL] Production database unreachable. Check pooler and credentials.")

    yield

    await engine.dispose()
    logger.info("[SHUTDOWN] Database engine connection pool disposed.")


def create_app() -> FastAPI:
    is_prod = settings.APP_ENV == "production"

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="1.0.0",
        description=(
            "FastAPI Production Backend for B.S. Hotel & Restaurant and Delicee Restaurant (Mathura NH-2). "
            "Powers public room bookings, food ordering, event enquiries, reviews, and admin dashboard."
        ),
        docs_url=None if is_prod else "/docs",
        redoc_url=None if is_prod else "/redoc",
        openapi_url=None if is_prod else "/openapi.json",
        lifespan=lifespan,
    )

    # Attach slowapi rate limiter state
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Middleware
    app.add_middleware(RequestIDMiddleware)
    if is_prod and settings.ALLOWED_HOSTS and settings.ALLOWED_HOSTS != ["*"]:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.ALLOWED_HOSTS
            if isinstance(settings.ALLOWED_HOSTS, list)
            else [settings.ALLOWED_HOSTS],
        )

    cors_origins = settings.CORS_ORIGINS
    if isinstance(cors_origins, str):
        try:
            parsed = json.loads(cors_origins)
            origins_list = parsed if isinstance(parsed, list) else [cors_origins]
        except Exception:
            origins_list = [i.strip() for i in cors_origins.split(",") if i.strip()]
    elif isinstance(cors_origins, list):
        origins_list = [str(o) for o in cors_origins]
    else:
        origins_list = ["*"]

    base_defaults = [
        "https://bshotal.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]
    if "*" not in origins_list:
        for d in base_defaults:
            if d not in origins_list:
                origins_list.append(d)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins_list,
        allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Custom Exception Handlers
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "Validation Error",
                "details": exc.errors(),
                "body": str(exc.body) if exc.body else None,
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled server exception: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "Internal Server Error",
                "details": str(exc) if settings.DEBUG and not is_prod else None,
            },
        )

    # Health check endpoint (Liveness probe)
    @app.get("/health", tags=["System"])
    async def health_check():
        return {
            "status": "healthy",
            "project": settings.PROJECT_NAME,
            "environment": settings.APP_ENV,
            "version": "1.0.0",
        }

    # Readiness check endpoint (runs SELECT 1 against database without leaking credentials)
    @app.get("/ready", tags=["System"])
    async def readiness_check(db: AsyncSession = Depends(get_db)):
        try:
            await db.execute(text("SELECT 1"))
            return {
                "status": "ready",
                "database": "connected",
                "environment": settings.APP_ENV,
            }
        except Exception as exc:
            logger.error("Readiness check DB error: %s", type(exc).__name__)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "status": "not_ready",
                    "database": "disconnected",
                    "error": "Database connectivity check failed",
                },
            )

    # Mount API routers
    app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
    app.include_router(customer_auth_router, prefix=settings.API_V1_PREFIX)
    app.include_router(public_router, prefix=settings.API_V1_PREFIX)
    app.include_router(admin_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()
