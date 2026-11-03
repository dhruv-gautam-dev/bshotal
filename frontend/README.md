# B.S. Hotel & Delicee Restaurant — website + admin dashboard

A single React app that contains both the public website and a staff dashboard, running on the
Base44 platform (database, authentication, hosting).

## What is inside

| Area | Path | Notes |
| --- | --- | --- |
| Public website | `/`, `/rooms`, `/booking`, `/restaurant`, `/order`, `/events`, `/gallery`, `/reviews`, `/contact` | Reads menu, room types and settings from the database |
| Staff sign-in | `/admin/login` | Email + password (platform auth, rate limited, optional MFA) |
| Dashboard | `/admin` | Overview, bookings, orders, rooms & availability, menu, enquiries, reviews, customers, reports, settings |
| Database schema | `base44/entities/*.jsonc` | Access rules (RLS) live in each schema |

## Data model

`Booking`, `Payment`, `RoomType`, `Room`, `BlockedDate`, `PricingRule`, `MenuCategory`, `MenuItem`,
`Order` (line items embedded), `Enquiry` (event + contact messages), `EventPackage`, `Review`,
`Setting` (single row), `AuditLog`, `User` (adds `staff_role`, `staff_active`).

Bookings and orders keep their own status history; money is tracked with `Payment` rows
(advance / balance / refund) plus `advance_paid` and `balance` on the booking.

## Roles

| Role | Access |
| --- | --- |
| Owner (`role = admin` or `staff_role = owner`) | Everything, including settings, staff accounts and the audit log |
| Manager (`staff_role = manager`) | Bookings, orders, rooms, menu, reviews, enquiries, customers, reports |
| Staff (`staff_role = staff`) | Bookings and orders only — no prices, settings, reports or deletes |

Roles are stored on the user record in the **locked** `staff_role` field (only an owner can change
it). They are enforced by the entity access rules on the server, not by hiding menu items. Every
mutation also writes an `AuditLog` row.

## Seeding

1. Settings, 3 room types and 9 room numbers are already seeded.
2. Open **Menu → Import built-in menu** once to copy the printed menu (`src/data/menu.js`) into the
   database. After that, menu edits in the dashboard control the website.
3. Make your own account the owner: in the dashboard **Settings → Staff accounts** set your role to
   *Owner* (or set `role = admin` on the user).

## Manual configuration still needed

- **Owner email** for alerts (Settings → Operations). Email delivery to outside addresses also needs
  a connected custom domain.
- **Razorpay**: add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (see
  `.env.example`). The `Payment` entity already has a `gateway_ref` field; create a payment record
  from the webhook when you enable the gateway.
- **WhatsApp / SMS notifications**: fill the webhook URL in Settings → Operations later.
- **Domain, publishing, SEO**: publish from the editor, then connect the domain in Dashboard → Domains.
- **Menu / room photos, FSSAI & GST numbers, real prices** — replace the seeded placeholders.

## Platform note (important)

This app runs on the **free plan**, which does not include backend functions. Therefore:

- Authentication, password hashing, sessions, OTP, "forgot password" and login rate limiting are
  handled by the platform — never hand-rolled here.
- All data access goes through the platform SDK, protected by per-entity row-level rules.
- Availability is checked against live bookings before a booking is saved, and every pending
  request stays visible in the dashboard so a clash is caught before confirming. A truly atomic
  server-side lock needs a backend function (**Builder plan or higher**), as do a custom REST API,
  CSV import on the server and SMTP-based email.

Upgrading to Builder+ unlocks those without changing the screens.

## Run locally

```bash
npm install
npm run dev      # https://localhost:5173 (Base44 preview)
npm run build    # production bundle
```

## Project layout

```
src/
  admin/            dashboard (layout, guard, pages, shared helpers)
  components/site/  public website components
  data/             static fallback content (menu, rooms, event copy)
  hooks/            useMenu / useRoomTypes / useOrderConfig
  lib/              publicApi (website ↔ database), services (forms), i18n, whatsapp
base44/entities/    database schema + access rules
``