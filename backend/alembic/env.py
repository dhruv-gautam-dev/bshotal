import asyncio
import logging
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.core.config import settings
from app.models import Base

logger = logging.getLogger("alembic.env")

# Alembic Config object
config = context.config

# Migrations MUST use direct connection or session pooler (port 5432), never transaction pooler (port 6543)
target_url = settings.DIRECT_DATABASE_URL or settings.DATABASE_URL

if ":6543" in target_url:
    logger.warning(
        "[ALEMBIC WARNING] Migrations URL uses port 6543 (transaction pooler). "
        "PgBouncer in transaction mode does not support transactional DDL. "
        "Please set DIRECT_DATABASE_URL to Supabase direct port 5432 or session pooler."
    )

config.set_main_option("sqlalchemy.url", target_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = target_url
    
    connect_args = {}
    if "postgresql+asyncpg" in target_url and "ssl=" not in target_url and "supabase" in target_url.lower():
        connect_args["ssl"] = "require"

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
