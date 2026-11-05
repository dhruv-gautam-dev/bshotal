"""
Security Test: Supabase PostgREST Row Level Security (RLS) Lock Verification.
Asserts that querying tables directly via the public Supabase anon key returns NO data.
"""
import httpx
import pytest

from app.core.config import settings


@pytest.mark.asyncio
async def test_supabase_rls_blocks_anon_direct_access():
    """
    Direct PostgREST queries using public anon key must be rejected or return empty results,
    verifying that Row Level Security (RLS) and REVOKE privileges are strictly active.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        pytest.skip("SUPABASE_URL and SUPABASE_ANON_KEY not set; skipping live Supabase RLS test.")

    base_url = settings.SUPABASE_URL.rstrip("/")
    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
    }

    sensitive_tables = [
        "users",
        "customers",
        "bookings",
        "orders",
        "refresh_tokens",
        "audit_logs",
        "settings",
    ]

    async with httpx.AsyncClient(timeout=10.0) as client:
        for table in sensitive_tables:
            resp = await client.get(f"{base_url}/rest/v1/{table}?select=*", headers=headers)

            # RLS enabled with REVOKE results in either 401/403 or 200 with empty [] list
            if resp.status_code in (401, 403, 404):
                # Access denied at permission level - SECURE
                assert True
            elif resp.status_code == 200:
                data = resp.json()
                # Must be completely empty - zero rows leaked
                assert data == [], f"Security Alert: Table '{table}' exposed rows over public anon key!"
            else:
                # Any other error response is also non-leaking
                assert resp.status_code >= 400

