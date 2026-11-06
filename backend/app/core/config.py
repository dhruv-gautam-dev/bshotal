import json

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    # Project metadata
    PROJECT_NAME: str = "B.S. Hotel & Restaurant API"
    ENVIRONMENT: str = "development"
    APP_ENV: str = "development"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True

    # Database URLs
    # Runtime app: Supabase pooler (e.g. port 6543 transaction or port 5432 session) or SQLite
    DATABASE_URL: str = "sqlite+aiosqlite:///./bshotel.db"
    # Migrations only: Supabase DIRECT or session-pooler connection (port 5432), never transaction pooler
    DIRECT_DATABASE_URL: str | None = None

    # Supabase Managed Services (Postgres & Storage)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""  # Backend only - never exposed to browser
    SUPABASE_ANON_KEY: str = ""          # Used only for RLS verification security testing
    SUPABASE_STORAGE_BUCKET_ROOMS: str = "room-photos"
    SUPABASE_STORAGE_BUCKET_MENU: str = "menu-photos"
    SUPABASE_STORAGE_BUCKET_GALLERY: str = "gallery"
    SUPABASE_STORAGE_BUCKET_INVOICES: str = "invoices"

    # Database Connection Pool Tuning (Supabase limits)
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 5
    DB_POOL_RECYCLE: int = 300
    DB_POOL_PRE_PING: bool = True
    STATEMENT_CACHE_SIZE: int = 0  # 0 disables statement cache for PgBouncer transaction mode

    # Observability & Hosts
    SENTRY_DSN: str | None = None
    ALLOWED_HOSTS: list[str] | str = ["*"]

    @field_validator("DATABASE_URL", "DIRECT_DATABASE_URL", mode="before")
    @classmethod
    def ensure_asyncpg_driver(cls, v: str | None) -> str | None:
        if isinstance(v, str) and v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://") :]
        return v

    # Security & Tokens
    SECRET_KEY: str = "development_secret_key_change_in_production_bshotel_nh2_mathura"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = 2

    # CORS
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://bshotal.vercel.app",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed]
            except Exception:
                pass
        return v  # type: ignore

    # Initial Admin Seed
    INITIAL_OWNER_EMAIL: str = "owner@bshotel.com"
    INITIAL_OWNER_PHONE: str = "+919149224039"
    INITIAL_OWNER_PASSWORD: str = "Bshotel@Admin2026"
    INITIAL_OWNER_NAME: str = "General Manager"

    # Contact & WhatsApp Numbers
    HOTEL_BOOKINGS_PHONE: str = "+919149224039"
    HOTEL_PAYMENTS_PHONE: str = "+919259273735"
    HOTEL_ADDRESS: str = "Near Township Nagar, NH-2, Mathura, Uttar Pradesh - 281006"

    # SMTP / Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "bookings@bshotel.com"
    EMAILS_FROM_NAME: str = "B.S. Hotel & Restaurant"

    # Payments / Razorpay
    RAZORPAY_KEY_ID: str = "rzp_test_placeholder"
    RAZORPAY_KEY_SECRET: str = "rzp_test_secret_placeholder"


settings = Settings()
