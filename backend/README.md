# B.S. Hotel & Restaurant - FastAPI Backend

Production-ready backend for **B.S. Hotel & Restaurant** and **Delicee Restaurant** (Near Township Nagar, NH-2, Mathura, Uttar Pradesh).

Powers both the public customer experience (rooms booking, online food ordering, banquet enquiries, reviews) and the comprehensive admin management portal (Owner, Manager, Staff roles).

---

## Tech Stack & Architecture

- **Runtime & Framework**: Python 3.11+, [FastAPI](https://fastapi.tiangolo.com/), Uvicorn (ASGI)
- **Database**: PostgreSQL 16 (production) / SQLite with `aiosqlite` (local test & development)
- **ORM & Migrations**: SQLAlchemy 2.0 (asyncio) + Alembic migrations
- **Data Validation & Settings**: Pydantic v2 + `pydantic-settings`
- **Security & Auth**: Dual-identifier login (email or phone), bcrypt password hashing, rotating refresh tokens with SHA-256 database storage, JWT access tokens, role-based dependency access control (`owner`, `manager`, `staff`)
- **Concurrency & Availability**: Row-level locking (`SELECT ... FOR UPDATE` / transaction serialization) ensuring zero double-bookings under concurrent checkout requests
- **Pricing & Currency Integrity**: Server-side price recalculation (in Decimal) strictly ignoring client-sent totals; dynamic weekend/festival pricing rule overrides
- **Live Streams**: Server-Sent Events (SSE) broadcast for live kitchen order tickets (KOT) and dashboard notifications
- **PDF Generation**: ReportLab PDF engine for official booking confirmation invoices, kitchen order tickets (KOT), and restaurant receipts
- **Anti-Spam**: SlowAPI IP rate limiting + honeypot detection on public POST endpoints
- **Testing**: `pytest` + `pytest-asyncio` + `httpx.AsyncClient`

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app factory, middleware, exception handlers
│   ├── core/                   # Config, security, deps, rate limiting, logging
│   ├── db/                     # Base model, async engine, and session management
│   ├── models/                 # 16 SQLAlchemy 2.0 models + auxiliary tables
│   ├── schemas/                # Pydantic v2 schemas (Create, Update, Out, Reports)
│   ├── services/               # Business logic (availability, pricing, bookings, orders, audit, reports)
│   ├── utils/                  # ReportLab PDF generator, pagination, WhatsApp builder, SMTP email
│   ├── api/
│   │   ├── auth.py             # Admin/staff login, refresh, profile, password reset
│   │   ├── customer_auth.py    # Optional guest accounts (separate module)
│   │   ├── public/             # Public endpoints (settings, rooms, bookings, menu, orders, events, reviews)
│   │   └── admin/              # Dashboard endpoints (overview KPIs, bookings, rooms, orders, menu, etc.)
│   └── seed/                   # Seed dataset & CLI script with --demo mode
├── docs/
│   └── frontend-integration.md # Complete frontend connection guide
├── tests/                      # Concurrency, pricing, auth, status transition tests
├── docker-compose.yml          # PostgreSQL 16 container definition
├── alembic.ini & alembic/      # Alembic migration environment
├── requirements.txt
├── pyproject.toml
└── README.md
```

---

## Quickstart (Windows PowerShell & Linux)

### 1. Prerequisites
- Python 3.11+ installed (or Astral `uv`)
- Docker & Docker Compose (optional, for running local PostgreSQL)

### 2. Environment Setup
Clone the repository and copy the sample environment file:

```powershell
# Windows PowerShell
cd backend
Copy-Item .env.example .env
```

```bash
# Linux / macOS
cd backend
cp .env.example .env
```

### 3. Install Dependencies

Using `uv` (recommended, blazing fast):
```powershell
uv pip install -r requirements.txt
```

Or using standard `pip`:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1    # On Linux: source .venv/bin/activate
pip install -r requirements.txt
```

### 4. Database Setup

#### Option A: Local SQLite (Zero Setup, Default)
Leave `DATABASE_URL="sqlite+aiosqlite:///./bshotel.db"` in `.env`. Tables are created automatically on boot.

#### Option B: PostgreSQL with Docker
Start the database container:
```powershell
docker compose up -d db
```
Update `.env`:
```
DATABASE_URL="postgresql+asyncpg://bshotel:bshotel_secret@localhost:5432/bshotel_db"
```

### 5. Seed Database
Seed standard site settings, room inventory, full Delicee pure-veg menu, and initial owner account:
```powershell
# Standard seed
python -m app.seed.seed_data

# Or seed with interactive demo data (mock bookings, active orders, reviews)
python -m app.seed.seed_data --demo
```

Default Owner Credentials created:
- **Email**: `owner@bshotel.com`
- **Phone**: `+919149224039`
- **Password**: `Bshotel@Admin2026`
*(Owner is prompted to change password on first login)*

### 6. Start the Server
Run with `--reload-dir app` so the file watcher watches only the `app` code directory (preventing OneDrive / `.venv` / `.db` reload loops on Windows):
```powershell
# Using the pre-configured script:
.\dev.ps1

# Or with uvicorn directly:
uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
```
- Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Interactive ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- Health check: [http://localhost:8000/health](http://localhost:8000/health)

---

## Running the Automated Test Suite

Run the full async test suite covering auth roles, concurrency race conditions, pricing calculation, and status transitions:
```powershell
pytest -v
```

---

## Code Quality & Formatting
```powershell
ruff check .
ruff format .
```

---

## API Summary

| Method | Endpoint | Description | Role Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Login with email or phone + password | Public |
| `POST` | `/api/v1/auth/refresh` | Refresh JWT access token | Public |
| `GET` | `/api/v1/auth/me` | Current authenticated user profile | Any Active Staff |
| `GET` | `/api/v1/public/settings` | Property information, policies & contacts | Public |
| `GET` | `/api/v1/public/rooms` | Room types list with photos & amenities | Public |
| `GET` | `/api/v1/public/rooms/availability` | Check availability & get pricing quote | Public |
| `POST` | `/api/v1/public/bookings` | Submit room booking request (race-protected) | Public |
| `GET` | `/api/v1/public/menu` | Full Delicee pure-veg menu with Hindi names | Public |
| `POST` | `/api/v1/public/orders` | Place food order (prices recalculated server-side) | Public |
| `GET` | `/api/v1/public/orders/status` | Check live status by reference + phone | Public |
| `GET` | `/api/v1/public/events/packages` | Active banquet & ceremony packages | Public |
| `POST` | `/api/v1/public/events/enquiry` | Submit wedding/party inquiry form | Public |
| `GET` | `/api/v1/public/reviews` | Approved customer ratings & reviews | Public |
| `POST` | `/api/v1/public/reviews` | Submit new review (saved as pending) | Public |
| `GET` | `/api/v1/admin/overview/kpis` | Real-time occupancy, revenue & stats | Staff+ |
| `GET` | `/api/v1/admin/bookings` | Bookings list with search & pagination | Staff+ |
| `PATCH` | `/api/v1/admin/bookings/{id}/status` | Check-in, check-out, confirm, cancel | Staff+ |
| `GET` | `/api/v1/admin/bookings/{id}/invoice` | Download official booking PDF invoice | Staff+ |
| `GET` | `/api/v1/admin/orders` | Food orders Kanban / list | Staff+ |
| `PATCH` | `/api/v1/admin/orders/{id}/status` | Update preparation & delivery stage | Staff+ |
| `GET` | `/api/v1/admin/orders/{id}/kot` | Download Kitchen Order Ticket (KOT) PDF | Staff+ |
| `GET` | `/api/v1/admin/orders/{id}/bill` | Download customer bill PDF | Staff+ |
| `GET` | `/api/v1/admin/rooms/calendar` | Month availability grid per room type | Staff+ |
| `POST` | `/api/v1/admin/menu/bulk-price-update` | Bulk adjust category prices (% or fixed) | Manager+ |
| `GET` | `/api/v1/admin/reports/summary` | Financial revenue & tax report | Owner Only |
| `GET` | `/api/v1/admin/staff` | Manage staff accounts | Owner Only |
| `GET` | `/api/v1/admin/audit` | Comprehensive audit trail logs | Owner Only |
| `GET` | `/api/v1/admin/notifications/stream` | Server-Sent Events (SSE) live updates | Staff+ |

