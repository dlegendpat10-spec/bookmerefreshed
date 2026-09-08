# Bookme — Database SQL & Schema Documentation

> **Target Database:** PostgreSQL 14+ / Supabase PostgreSQL  
> **Source Files:** [`db/schema.sql`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/bookme-backend/db/schema.sql) · [`db/seed.sql`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/bookme-backend/db/seed.sql) · [`db/init.sql`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/bookme-backend/db/init.sql)

---

## 1. File Structure

```
bookme-backend/
└── db/
    ├── schema.sql    # Complete PostgreSQL DDL (Tables, Enums, Triggers, RLS, Indexes, Functions)
    ├── seed.sql      # Seed data matching frontend SEED in js/api.js
    └── init.sql      # Combined one-step execution script
```

---

## 2. Key Components

### 2.1 Enums & Types
- `booking_status`: `'PENDING'`, `'CONFIRMED'`, `'COMPLETED'`, `'CANCELLED'`, `'RESCHEDULED'`
- `payment_status`: `'UNPAID'`, `'PENDING'`, `'PAID'`, `'FAILED'`, `'REFUNDED'`
- `user_role`: `'CUSTOMER'`, `'BUSINESS_ADMIN'`, `'PLATFORM_ADMIN'`
- `notification_channel`: `'EMAIL'`, `'SMS'`, `'WHATSAPP'`

### 2.2 Tables Created
1. `businesses`: Multi-tenant white-label business configs.
2. `services`: Business services, pricing, durations, buffer times, active flags.
3. `customers`: Customer records scoped by `(business_id, email)`.
4. `service_bookings`: Bookings table with PostgreSQL **GIST exclusion constraint (`no_double_booking`)** enforcing zero double-booking at DB level.
5. `business_hours`: Operating schedule per day of week (0=Sun .. 6=Sat).
6. `blocked_dates`: Specific dates blocked for business operations.
7. `admin_profiles`: Admin user lookup linked to auth system.
8. `notification_dispatches`: Log audit table for async notifications.
9. `scheduled_reminders`: Pre-appointment notification schedule.
10. `idempotency_keys`: Cache table for idempotent API requests.

### 2.3 Double-Booking Exclusion Lock
```sql
CONSTRAINT no_double_booking
EXCLUDE USING gist (
  business_id       WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&
) WHERE (status <> 'CANCELLED')
```

### 2.4 Stored Procedure: `get_available_slots`
- Calculates available time slots dynamically for any service on any date.
- Accounts for opening/closing hours, blocked dates, existing non-cancelled bookings, and lead time buffer.

---

## 3. How to Run

### Option A: Supabase SQL Editor
1. Open Supabase Dashboard -> SQL Editor.
2. Copy and paste contents of [`db/schema.sql`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/bookme-backend/db/schema.sql) and click **Run**.
3. Copy and paste contents of [`db/seed.sql`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/bookme-backend/db/seed.sql) and click **Run**.

### Option B: CLI Execution (psql)
```bash
psql $DATABASE_URL -f db/schema.sql
psql $DATABASE_URL -f db/seed.sql
```
