# Bookme — REST API Documentation

> **Version:** 1.0.0  
> **Base URL (Local):** `http://localhost:5000/api/v1`  
> **Base URL (Production):** `https://bookme-api.onrender.com/api/v1`  
> **Format:** Standard JSON with `{ data, error }` envelopes  

---

## 1. Overview & Architecture

The Bookme REST API powers the multi-tenant service booking platform. It is designed to match the mock API contract in `js/api.js` on a 1-to-1 basis, allowing the frontend to seamlessly switch from in-memory mock storage to live backend endpoints without changing UI rendering code.

### 1.1 Response Envelope
All API endpoints return JSON conforming to the following shape:

```json
// Success Response (HTTP 200 / 201)
{
  "data": { ... },
  "error": null
}

// Failure Response (HTTP 400 / 401 / 403 / 404 / 409 / 500)
{
  "data": null,
  "error": "Human readable error description"
}
```

---

## 2. Authentication & Headers

### 2.1 Admin Authentication
Admin routes require a Bearer token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

Tokens are issued via `POST /api/v1/auth/login`.

### 2.2 Idempotency Key
Creation routes (such as `POST /api/v1/bookings`) accept an optional idempotency header to prevent duplicate submissions:

```http
X-Idempotency-Key: 7b9a8c2d-1234-4567-89ab-cdef01234567
```

### 2.3 Rate Limiting
Public booking endpoints are rate-limited to **20 requests per 15 minutes** per IP address. Exceeding this limit returns HTTP 429.

---

## 3. API Endpoint Summary

| Category | Method | Endpoint | Access | Description |
|---|---|---|---|---|
| **Auth** | `POST` | `/auth/login` | Public | Admin login, returns JWT token |
| **Auth** | `POST` | `/auth/logout` | Admin | Revokes / logs out current session |
| **Services** | `GET` | `/services` | Public | List active services |
| **Services** | `GET` | `/services/:id` | Public | Get single service details |
| **Services** | `POST` | `/admin/services` | Admin | Create a new service |
| **Services** | `PATCH` | `/admin/services/:id` | Admin | Update service details |
| **Services** | `DELETE` | `/admin/services/:id` | Admin | Soft-delete a service (`is_active=false`) |
| **Customers** | `POST` | `/customers` | Public | Create / Upsert customer during booking |
| **Customers** | `GET` | `/admin/customers` | Admin | List all customers |
| **Customers** | `GET` | `/admin/customers/:id` | Admin | Get single customer details |
| **Customers** | `PATCH` | `/admin/customers/:id` | Admin | Update customer details |
| **Customers** | `DELETE` | `/admin/customers/:id` | Admin | Delete customer record |
| **Customers** | `GET` | `/admin/customers/:id/bookings` | Admin | Get all bookings for a customer |
| **Bookings** | `POST` | `/bookings` | Public | Create new booking (Step 4 of wizard) |
| **Bookings** | `GET` | `/admin/bookings` | Admin | List bookings with filters & search |
| **Bookings** | `GET` | `/admin/bookings/:id` | Admin | Get single booking details |
| **Bookings** | `PATCH` | `/admin/bookings/:id/status` | Admin | Update booking status (`CONFIRMED`, `CANCELLED`, etc.) |
| **Slots** | `GET` | `/slots` | Public | Calculate available time slots for service & date |
| **Availability**| `GET` | `/business/hours` | Public | Get operating business hours (Sun-Sat) |
| **Availability**| `PATCH` | `/admin/business/hours/:dow` | Admin | Update business hours for day of week (0-6) |
| **Availability**| `GET` | `/business/blocked-dates` | Public | Get list of blocked operating dates |
| **Availability**| `POST` | `/admin/business/blocked-dates` | Admin | Block a specific date |
| **Availability**| `DELETE` | `/admin/business/blocked-dates/:id` | Admin | Unblock a date |
| **Dashboard** | `GET` | `/admin/dashboard/stats` | Admin | Get summary statistics for admin dashboard |

---

## 4. Endpoint Specifications

### 4.1 Authentication

#### `POST /auth/login`
Authenticates admin user and returns access token.

- **Request Body:**
  ```json
  {
    "email": "admin@bookme.app",
    "password": "admin123"
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "data": {
      "id": "00000000-0000-0000-0000-000000000002",
      "email": "admin@bookme.app",
      "full_name": "Admin User",
      "role": "BUSINESS_ADMIN",
      "access_token": "eyJhbGciOiJIUzI1NiIsIn..."
    },
    "error": null
  }
  ```
- **Response 401 Unauthorized:**
  ```json
  {
    "data": null,
    "error": "Invalid email or password"
  }
  ```

---

### 4.2 Services

#### `GET /services`
Lists active services for booking widget.

- **Query Parameters:**
  - `includeInactive` (optional, boolean): Set to `true` for admin view.
- **Response 200 OK:**
  ```json
  {
    "data": [
      {
        "id": "11111111-0000-0000-0000-000000000001",
        "business_id": "00000000-0000-0000-0000-000000000001",
        "name": "Discovery Call",
        "description": "A free 30-minute introductory session to understand your educational needs.",
        "duration_minutes": 30,
        "buffer_minutes": 0,
        "price": "0.00",
        "is_active": true,
        "icon": "🎯",
        "category": "intro"
      }
    ],
    "error": null
  }
  ```

#### `POST /admin/services`
Creates a new service (Admin only).

- **Request Body:**
  ```json
  {
    "name": "SAT Masterclass",
    "description": "Comprehensive SAT math and verbal review.",
    "duration_minutes": 90,
    "buffer_minutes": 15,
    "price": 35000,
    "icon": "📚",
    "category": "exam"
  }
  ```
- **Response 201 Created:** Full created service object.

---

### 4.3 Time Slots & Availability

#### `GET /slots`
Generates available time slots for a given service and date using DB stored procedure `get_available_slots`.

- **Query Parameters:**
  - `serviceId` (required, UUID)
  - `date` (required, `YYYY-MM-DD`)
- **Response 200 OK:**
  ```json
  {
    "data": [
      {
        "time": "09:00",
        "end": "10:30",
        "display": "09:00 AM",
        "available": true
      },
      {
        "time": "10:00",
        "end": "11:30",
        "display": "10:00 AM",
        "available": false
      }
    ],
    "error": null
  }
  ```

---

### 4.4 Bookings

#### `POST /bookings`
Creates a new booking (Step 4 of public booking flow). Handled atomically in PostgreSQL with GIST exclusion constraint.

- **Headers:** `X-Idempotency-Key` (recommended)
- **Request Body:**
  ```json
  {
    "service_id": "11111111-0000-0000-0000-000000000002",
    "customer_id": "22222222-0000-0000-0000-000000000001",
    "booking_date": "2026-09-15",
    "start_time": "10:00",
    "notes": "Focused on WAEC math prep"
  }
  ```
- **Response 201 Created:**
  ```json
  {
    "data": {
      "id": "e4f8d9c1-5b2a-4f81-9c3e-7a1b0d2e3f4a",
      "booking_reference": "BKM-9X2K",
      "booking_date": "2026-09-15",
      "start_time": "10:00",
      "end_time": "11:45",
      "status": "PENDING",
      "payment_status": "UNPAID",
      "amount": "25000.00",
      "customer_notes": "Focused on WAEC math prep"
    },
    "error": null
  }
  ```
- **Response 409 Conflict (Double Booking Blocked by DB):**
  ```json
  {
    "data": null,
    "error": "This time slot is no longer available. Please choose another."
  }
  ```

#### `GET /admin/bookings`
Retrieves bookings with pagination and filters (Admin only).

- **Query Parameters:**
  - `status` (`PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`)
  - `date` (`YYYY-MM-DD`)
  - `q` (search term for customer name, email, or reference)
  - `page` (default 1)
  - `limit` (default 50)

---

### 4.5 Dashboard Statistics

#### `GET /admin/dashboard/stats`
Returns aggregated business metrics for the admin dashboard.

- **Response 200 OK:**
  ```json
  {
    "data": {
      "todayCount": 2,
      "totalCustomers": 10,
      "pendingCount": 3,
      "monthRevenue": 135000,
      "totalBookings": 12
    },
    "error": null
  }
  ```

---

## 5. Error Code Matrix

| Status Code | Scenario | Error Message |
|---|---|---|
| **400 Bad Request** | Missing required parameters | `"service_id, customer_id, booking_date, and start_time are required"` |
| **401 Unauthorized** | Missing or invalid Bearer JWT | `"Unauthorized - Missing or malformed token"` |
| **404 Not Found** | Record not found | `"Service not found"` / `"Booking not found"` |
| **409 Conflict** | Double-booking slot overlap | `"This time slot is no longer available. Please choose another."` |
| **429 Too Many Requests** | Rate limit exceeded | `"Too many booking attempts. Please try again later."` |
| **500 Internal Error** | Server error | `"Internal Server Error"` |

---

*Generated by Antigravity IDE · Bookme API Documentation*
