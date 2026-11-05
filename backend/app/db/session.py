from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

logger = logging.getLogger("bshotel.db")

# Build engine parameters
connect_args: dict = {}
engine_kwargs: dict = {
    "echo": settings.DEBUG and settings.APP_ENV == "development",
    "future": True,
}

if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False
    engine_kwargs["connect_args"] = connect_args
else:
    # PostgreSQL with asyncpg (Supabase or self-hosted)
    # Supabase Transaction Pooler (port 6543 / PgBouncer) requires statement_cache_size=0
    # to avoid "prepared statement __asyncpg_0__ does not exist / already exists" errors across pool connections.
    connect_args["statement_cache_size"] = settings.STATEMENT_CACHE_SIZE

    # Require SSL if connecting to Supabase or in non-local environments
    is_supabase = "supabase" in settings.DATABASE_URL.lower()
    if (is_supabase or settings.APP_ENV in ("staging", "production")) and "ssl=" not in settings.DATABASE_URL:
        connect_args["ssl"] = "require"

    engine_kwargs.update(
        {
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_pre_ping": settings.DB_POOL_PRE_PING,
            "pool_recycle": settings.DB_POOL_RECYCLE,
            "connect_args": connect_args,
        }
    )

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields an async database session."""
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
