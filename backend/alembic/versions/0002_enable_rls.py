"""enable_rls_and_lockdown

Revision ID: 0002_enable_rls
Revises: 0001_initial_schema
Create Date: 2026-11-05 21:26:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '0002_enable_rls'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = [
    'settings',
    'users',
    'refresh_tokens',
    'customers',
    'room_types',
    'rooms',
    'blocked_dates',
    'pricing_rules',
    'bookings',
    'booking_history',
    'menu_categories',
    'menu_items',
    'orders',
    'order_items',
    'payments',
    'enquiries',
    'event_packages',
    'reviews',
    'audit_logs',
    'notifications',
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    # 1. Enable RLS on every application table
    for table in TABLES:
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY;')

    # 2. Enable RLS on alembic_version metadata table if it exists
    op.execute('ALTER TABLE IF EXISTS "alembic_version" ENABLE ROW LEVEL SECURITY;')

    # 3. Revoke all privileges from public API roles (anon and authenticated)
    # This prevents Supabase PostgREST from reading or mutating ANY table via the public anon key.
    # The FastAPI backend connects as 'postgres' superuser/service role, which bypasses RLS by default.
    op.execute('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;')
    op.execute('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;')
    op.execute('REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;')
    op.execute('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;')
    op.execute('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;')
    op.execute('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;')


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return

    for table in TABLES:
        op.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY;')
    op.execute('ALTER TABLE IF EXISTS "alembic_version" DISABLE ROW LEVEL SECURITY;')

