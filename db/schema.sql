-- ===================================================================
-- BOOKME — DATABASE SCHEMA & QUERY SUITE (PostgreSQL / Supabase DDL)
-- Target Database: PostgreSQL 14+ / Supabase PostgreSQL
-- Features: Multi-tenancy, Row Level Security (RLS), GIST Exclusion Lock
--           for zero double-booking, Stored Procedures, and Seed Data.
-- ===================================================================

-- -------------------------------------------------------------------
-- 1. EXTENSIONS
-- -------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- Required for multi-column GIST exclusion constraint

-- -------------------------------------------------------------------
-- 2. ENUM TYPES
-- -------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
      'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
      'UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
      'CUSTOMER', 'BUSINESS_ADMIN', 'PLATFORM_ADMIN'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM (
      'EMAIL', 'SMS', 'WHATSAPP'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- -------------------------------------------------------------------
-- 3. TRIGGER FUNCTION: AUTO UPDATED_AT TIMESTAMP
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------
-- 4. TABLE DEFINITIONS
-- -------------------------------------------------------------------

-- TABLE 1: BUSINESSES (Multi-tenant Business Configuration)
CREATE TABLE IF NOT EXISTS businesses (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                     VARCHAR(255)  NOT NULL,
  short_name               VARCHAR(100),
  slug                     VARCHAR(100)  UNIQUE NOT NULL,
  tagline                  TEXT,
  description              TEXT,
  logo_url                 TEXT,
  initials                 VARCHAR(4)    NOT NULL DEFAULT 'BM',
  accent_color             VARCHAR(20)   DEFAULT '#7C3AED',
  currency                 VARCHAR(10)   DEFAULT 'NGN',
  currency_symbol          VARCHAR(5)    DEFAULT '₦',
  locale                   VARCHAR(20)   DEFAULT 'en-NG',
  timezone                 VARCHAR(100)  DEFAULT 'Africa/Lagos',
  time_format              VARCHAR(3)    DEFAULT '12h',
  phone                    VARCHAR(50),
  email                    VARCHAR(255),
  address                  TEXT,
  booking_lead_time_hours   INT           DEFAULT 1,
  slot_interval_minutes     INT           DEFAULT 30,
  max_booking_days_ahead    INT           DEFAULT 60,
  social_instagram         TEXT,
  social_twitter           TEXT,
  social_whatsapp          TEXT,
  created_at               TIMESTAMPTZ   DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   DEFAULT NOW()
);

-- TABLE 2: SERVICES
CREATE TABLE IF NOT EXISTS services (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                     VARCHAR(255) NOT NULL,
  description              TEXT,
  duration_minutes         INT  NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes           INT  NOT NULL DEFAULT 0,
  price                    NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  icon                     VARCHAR(10),
  category                 VARCHAR(100),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 3: CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  first_name               VARCHAR(100) NOT NULL,
  last_name                VARCHAR(100) NOT NULL,
  email                    VARCHAR(255) NOT NULL,
  phone                    VARCHAR(50)  NOT NULL,
  notes                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (business_id, email)
);

-- TABLE 4: SERVICE_BOOKINGS (With DB-level GIST exclusion lock)
CREATE TABLE IF NOT EXISTS service_bookings (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_reference        VARCHAR(20) UNIQUE NOT NULL,
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id               UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  customer_id              UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  booking_date             DATE         NOT NULL,
  start_time               TIME         NOT NULL,
  end_time                 TIME         NOT NULL,
  starts_at                TIMESTAMPTZ  NOT NULL,
  ends_at                  TIMESTAMPTZ  NOT NULL,
  status                   booking_status NOT NULL DEFAULT 'PENDING',
  payment_status           payment_status NOT NULL DEFAULT 'UNPAID',
  amount                   NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency                 VARCHAR(10)  DEFAULT 'NGN',
  customer_notes           TEXT,
  created_at               TIMESTAMPTZ  DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  DEFAULT NOW(),

  -- Exclusion constraint enforcing no overlapping active bookings for same business
  CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    business_id       WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status <> 'CANCELLED')
);

-- TABLE 5: BUSINESS_HOURS
CREATE TABLE IF NOT EXISTS business_hours (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week              INT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  day_name                 VARCHAR(20) NOT NULL,
  opening_time             TIME NOT NULL DEFAULT '09:00',
  closing_time             TIME NOT NULL DEFAULT '17:00',
  is_open                  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (business_id, day_of_week)
);

-- TABLE 6: BLOCKED_DATES
CREATE TABLE IF NOT EXISTS blocked_dates (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  blocked_date             DATE        NOT NULL,
  reason                   VARCHAR(255),
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 7: ADMIN_PROFILES (Linked to Supabase auth.users or local auth)
CREATE TABLE IF NOT EXISTS admin_profiles (
  id                       UUID PRIMARY KEY,
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name                VARCHAR(255) NOT NULL,
  email                    VARCHAR(255) NOT NULL,
  role                     user_role NOT NULL DEFAULT 'BUSINESS_ADMIN',
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 8: NOTIFICATION_DISPATCHES (Audit trail)
CREATE TABLE IF NOT EXISTS notification_dispatches (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id               UUID NOT NULL REFERENCES service_bookings(id) ON DELETE CASCADE,
  channel                  notification_channel NOT NULL,
  recipient                VARCHAR(255) NOT NULL,
  status                   VARCHAR(50)  DEFAULT 'QUEUED',
  sent_at                  TIMESTAMPTZ,
  error_msg                TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE 9: SCHEDULED_REMINDERS
CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id               UUID NOT NULL REFERENCES service_bookings(id) ON DELETE CASCADE,
  channel                  notification_channel NOT NULL,
  remind_at                TIMESTAMPTZ NOT NULL,
  status                   VARCHAR(50) DEFAULT 'PENDING',
  dispatched_at            TIMESTAMPTZ
);

-- TABLE 10: IDEMPOTENCY_KEYS
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key                      VARCHAR(255) PRIMARY KEY,
  response_body            JSONB        NOT NULL,
  status_code              INT          NOT NULL,
  created_at               TIMESTAMPTZ  DEFAULT NOW()
);

-- -------------------------------------------------------------------
-- 5. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers(business_id, email, phone);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON service_bookings(business_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON service_bookings(business_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON service_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates ON blocked_dates(business_id, blocked_date);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON scheduled_reminders(remind_at, status);
CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_keys(created_at);

-- -------------------------------------------------------------------
-- 6. AUTO UPDATED_AT TRIGGERS
-- -------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_businesses_updated_at ON businesses;
CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_services_updated_at ON services;
CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_service_bookings_updated_at ON service_bookings;
CREATE TRIGGER trg_service_bookings_updated_at
  BEFORE UPDATE ON service_bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -------------------------------------------------------------------
-- 7. STORED PROCEDURE: GET_AVAILABLE_SLOTS
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_available_slots(
  p_business_id   UUID,
  p_service_id    UUID,
  p_date          DATE
)
RETURNS TABLE (
  slot_time       TIME,
  slot_end        TIME,
  display_time    TEXT,
  is_available    BOOLEAN
) LANGUAGE plpgsql AS $$
DECLARE
  v_duration      INT;
  v_opening       TIME;
  v_closing       TIME;
  v_interval      INT;
  v_lead_mins     INT;
  v_cursor        TIME;
  v_slot_end      TIME;
  v_dow           INT;
  v_is_open       BOOLEAN;
  v_is_blocked    BOOLEAN;
  v_is_taken      BOOLEAN;
  v_is_today      BOOLEAN;
  v_now_mins      INT;
  v_tz            TEXT;
BEGIN
  -- 1. Fetch service duration
  SELECT duration_minutes INTO v_duration
  FROM services
  WHERE id = p_service_id AND business_id = p_business_id AND is_active = TRUE;

  IF NOT FOUND THEN RETURN; END IF;

  -- 2. Fetch business config
  SELECT slot_interval_minutes, booking_lead_time_hours * 60, timezone
  INTO v_interval, v_lead_mins, v_tz
  FROM businesses WHERE id = p_business_id;

  -- 3. Fetch day's business hours
  v_dow := EXTRACT(DOW FROM p_date)::INT;

  SELECT opening_time, closing_time, is_open
  INTO v_opening, v_closing, v_is_open
  FROM business_hours
  WHERE business_id = p_business_id AND day_of_week = v_dow;

  IF NOT FOUND OR NOT v_is_open THEN RETURN; END IF;

  -- 4. Check blocked dates
  SELECT EXISTS (
    SELECT 1 FROM blocked_dates
    WHERE business_id = p_business_id AND blocked_date = p_date
  ) INTO v_is_blocked;

  IF v_is_blocked THEN RETURN; END IF;

  -- 5. Lead time check: is this today?
  v_is_today := (p_date = CURRENT_DATE AT TIME ZONE COALESCE(v_tz, 'Africa/Lagos'));
  v_now_mins := EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(v_tz, 'Africa/Lagos'))::INT * 60
              + EXTRACT(MINUTE FROM NOW() AT TIME ZONE COALESCE(v_tz, 'Africa/Lagos'))::INT;

  -- 6. Walk time slots
  v_cursor := v_opening;
  LOOP
    v_slot_end := v_cursor + (v_duration || ' minutes')::INTERVAL;
    EXIT WHEN v_slot_end > v_closing;

    -- Lead time: skip past slots if today
    IF v_is_today AND (EXTRACT(HOUR FROM v_cursor)::INT * 60 + EXTRACT(MINUTE FROM v_cursor)::INT) < (v_now_mins + v_lead_mins)
    THEN
      v_is_taken := TRUE;
    ELSE
      -- Conflict check
      SELECT EXISTS (
        SELECT 1 FROM service_bookings
        WHERE business_id = p_business_id
          AND booking_date = p_date
          AND status <> 'CANCELLED'
          AND (start_time, end_time) OVERLAPS (v_cursor, v_slot_end)
      ) INTO v_is_taken;
    END IF;

    slot_time    := v_cursor;
    slot_end     := v_slot_end;
    display_time := TO_CHAR(v_cursor, 'HH12:MI AM');
    is_available := NOT v_is_taken;
    RETURN NEXT;

    v_cursor := v_cursor + (v_interval || ' minutes')::INTERVAL;
  END LOOP;
END;
$$;

-- -------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------------
ALTER TABLE businesses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_bookings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours     ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles     ENABLE ROW LEVEL SECURITY;

-- Public Access Policies (Booking Flow)
CREATE POLICY "public_read_businesses" ON businesses FOR SELECT USING (TRUE);
CREATE POLICY "public_read_active_services" ON services FOR SELECT USING (is_active = TRUE);
CREATE POLICY "public_read_business_hours" ON business_hours FOR SELECT USING (TRUE);
CREATE POLICY "public_read_blocked_dates" ON blocked_dates FOR SELECT USING (TRUE);
CREATE POLICY "public_insert_customers" ON customers FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "public_insert_bookings" ON service_bookings FOR INSERT WITH CHECK (TRUE);

-- Admin Access Policies (Multi-tenant scoped by business_id)
CREATE POLICY "admin_manage_services" ON services FOR ALL
  USING (business_id = (SELECT business_id FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "admin_manage_customers" ON customers FOR ALL
  USING (business_id = (SELECT business_id FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "admin_manage_bookings" ON service_bookings FOR ALL
  USING (business_id = (SELECT business_id FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "admin_manage_hours" ON business_hours FOR ALL
  USING (business_id = (SELECT business_id FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "admin_manage_blocked_dates" ON blocked_dates FOR ALL
  USING (business_id = (SELECT business_id FROM admin_profiles WHERE id = auth.uid()));

-- -------------------------------------------------------------------
-- 9. SEED DATA (DEFAULT TENANT & INITIAL RECORDS)
-- -------------------------------------------------------------------
INSERT INTO businesses (
  id, name, short_name, slug, tagline, description, logo_url,
  initials, accent_color, currency, currency_symbol, locale, timezone, time_format,
  phone, email, address, booking_lead_time_hours, slot_interval_minutes, max_booking_days_ahead,
  social_instagram, social_twitter, social_whatsapp
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Bookme Appointments',
  'Bookme',
  'luxe-grooming',
  'Professional Appointment Scheduling',
  'Premium booking platform for advisory, consulting, and appointments.',
  NULL,
  'BM',
  '#10B981',
  'NGN',
  '₦',
  'en-NG',
  'Africa/Lagos',
  '12h',
  '+234 800 000 0000',
  'hello@bookme.app',
  'Lagos, Nigeria',
  1,
  30,
  60,
  NULL, NULL, NULL
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO admin_profiles (
  id, business_id, full_name, email, role
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Platform Admin',
  'admin@bookme.app',
  'BUSINESS_ADMIN'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO business_hours (business_id, day_of_week, day_name, opening_time, closing_time, is_open)
VALUES
  ('00000000-0000-0000-0000-000000000001', 0, 'Sunday',    '09:00', '13:00', FALSE),
  ('00000000-0000-0000-0000-000000000001', 1, 'Monday',    '09:00', '17:00', TRUE),
  ('00000000-0000-0000-0000-000000000001', 2, 'Tuesday',   '09:00', '17:00', TRUE),
  ('00000000-0000-0000-0000-000000000001', 3, 'Wednesday', '09:00', '17:00', TRUE),
  ('00000000-0000-0000-0000-000000000001', 4, 'Thursday',  '09:00', '17:00', TRUE),
  ('00000000-0000-0000-0000-000000000001', 5, 'Friday',    '09:00', '17:00', TRUE),
  ('00000000-0000-0000-0000-000000000001', 6, 'Saturday',  '10:00', '14:00', TRUE)
ON CONFLICT (business_id, day_of_week) DO UPDATE SET
  opening_time = EXCLUDED.opening_time,
  closing_time = EXCLUDED.closing_time,
  is_open      = EXCLUDED.is_open;

INSERT INTO services (id, business_id, name, description, duration_minutes, buffer_minutes, price, is_active, icon, category)
VALUES
  (
    '11111111-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Discovery Call',
    'A free 30-minute introductory session to understand your educational needs and goals.',
    30, 0, 0.00, TRUE, '🎯', 'intro'
  ),
  (
    '11111111-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Initial Consultation',
    'A comprehensive 90-minute deep-dive session covering academic history, learning style, and a customised study plan.',
    90, 15, 25000.00, TRUE, '📋', 'consultation'
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Follow-up Session',
    'A 45-minute progress review and strategy adjustment session for existing clients.',
    45, 0, 10000.00, TRUE, '🔄', 'session'
  ),
  (
    '11111111-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Full Academic Assessment',
    'An in-depth 2-hour assessment covering skill gaps, subject-by-subject analysis, and a detailed report with recommendations.',
    120, 15, 45000.00, TRUE, '📊', 'assessment'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  is_active = EXCLUDED.is_active;

INSERT INTO customers (id, business_id, first_name, last_name, email, phone, notes)
VALUES
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Amara', 'Okonkwo', 'amara.o@gmail.com', '+234 813 456 7890', 'Preparing for JAMB 2026. Very motivated student.'),
  ('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Emeka', 'Nwosu', 'emeka.nwosu@yahoo.com', '+234 802 987 6543', 'Parent-referred. Needs help with Maths and English.')
ON CONFLICT (business_id, email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone;
