# Frontend Integration Guide for B.S. Hotel & Restaurant & Delicee

This guide explains how to connect the React/Vite frontend to the FastAPI backend.

---

## 1. Base URL Configuration

In `frontend/.env.development`:
```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

In `frontend/.env.production`:
```bash
VITE_API_BASE_URL=https://api.bshotel.in/api/v1
```

---

## 2. Authentication Flow (Admin Dashboard)

The backend provides JWT authentication with rotating refresh tokens and role enforcement (`owner`, `manager`, `staff`).

### Endpoints
- **Login**: `POST /api/v1/auth/login`
  - Accepts either email or phone:
  ```json
  { "username": "owner@bshotel.com", "password": "YourPassword" }
  ```
  - Returns: `{ "access_token": "...", "refresh_token": "...", "user": { "id": "...", "role": "owner" } }`
- **Refresh Token**: `POST /api/v1/auth/refresh`
  - Pass `{ "refresh_token": "..." }`
- **Current User Profile**: `GET /api/v1/auth/me`
  - Requires header: `Authorization: Bearer <access_token>`

---

## 3. Public Website Integration

Public endpoints require **no login** and are optimized for fast response with built-in spam protection.

### A. Site Settings
- `GET /api/v1/public/settings`
- Returns property contacts, WhatsApp numbers, check-in/out times, and tax rates.

### B. Room Types & Real-Time Availability Quote
- **List Room Types**: `GET /api/v1/public/rooms`
- **Price Quote & Availability Check**:
  `GET /api/v1/public/rooms/availability?check_in=2026-11-10&check_out=2026-11-12&guests=2&rooms=1`
  - Server evaluates active seasonal/weekend pricing rules.
  - Returns calculated `base_amount`, `tax_amount` (12%), `total_amount`, and `available_rooms`.

### C. Booking Request Submission
- `POST /api/v1/public/bookings`
  ```json
  {
    "room_type_id": "uuid-here",
    "guest_name": "Rohan Sharma",
    "guest_phone": "+919876543210",
    "guest_email": "rohan@example.com",
    "check_in_date": "2026-11-10",
    "check_out_date": "2026-11-12",
    "num_rooms": 1,
    "num_guests": 2,
    "num_children": 0,
    "special_requests": "Arriving 2 PM"
  }
  ```
  - **Response**:
    ```json
    {
      "booking_reference": "BSH-2026-X8Y9Z0",
      "guest_name": "Rohan Sharma",
      "total_amount": 4032.00,
      "booking_status": "pending",
      "whatsapp_url": "https://wa.me/919149224039?text=...",
      "message": "Your booking request has been submitted..."
    }
    ```
  - The frontend can redirect the guest immediately to the returned `whatsapp_url` or display the reference on screen.

### D. Delicee Menu & Food Ordering
- **Get Full Menu**: `GET /api/v1/public/menu`
  - Returns hierarchical category list with items, Hindi titles, prices, veg flags, and bestseller tags.
- **Place Food Order**: `POST /api/v1/public/orders`
  ```json
  {
    "customer_name": "Pooja Verma",
    "customer_phone": "+919876543210",
    "order_type": "dine-in",
    "table_number": "T-04",
    "items": [
      { "menu_item_id": "uuid-paneer-tikka", "quantity": 1, "special_instructions": "Extra mint chutney" },
      { "menu_item_id": "uuid-butter-naan", "quantity": 2 }
    ]
  }
  ```
  - *Note*: Server recalculates all prices directly from the database and applies GST (5%) and delivery charges. Client-sent prices are ignored.
- **Check Order Status**: `GET /api/v1/public/orders/status?reference=ORD-2026-XXXXXX&phone=9876543210`

### E. Events & Banquet Enquiries
- **Packages**: `GET /api/v1/public/events/packages`
- **Submit Enquiry**: `POST /api/v1/public/events/enquiry`

### F. Reviews & Ratings
- **Get Approved Reviews**: `GET /api/v1/public/reviews?review_type=hotel`
- **Get Ratings Breakdown**: `GET /api/v1/public/reviews/summary?review_type=hotel`
- **Submit Review**: `POST /api/v1/public/reviews` (saved in `pending` status until admin approval)

---

## 4. Real-Time Admin Streaming (Live Kitchen / Orders)

Connect via standard HTML5 `EventSource`:
```javascript
const eventSource = new EventSource("http://localhost:8000/api/v1/admin/notifications/stream", {
  headers: { Authorization: `Bearer ${token}` }
});

eventSource.addEventListener("new_order", (e) => {
  const order = JSON.parse(e.data);
  console.log("New order received:", order);
  playChime();
});

eventSource.addEventListener("order_status_updated", (e) => {
  const update = JSON.parse(e.data);
  updateKanbanCard(update);
});
```

---

## 5. Standard Error Format

All errors return JSON in this consistent shape:
```json
{
  "error": "Error description or failure reason",
  "details": []
}
```
Validation errors return HTTP 422 with a field breakdown.
Spam / Honeypot attempts return HTTP 400.
Double booking attempts for sold-out dates return HTTP 409 Conflict.

