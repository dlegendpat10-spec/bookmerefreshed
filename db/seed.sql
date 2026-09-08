-- ===================================================================
-- BOOKME — SEED DATA SCRIPT (PostgreSQL / Supabase)
-- Version: 1.0
-- Description: Initial seed data mirroring frontend SEED in js/api.js
-- ===================================================================

-- 1. SEED DEFAULT BUSINESS (Pyaladea Academic Consult)
INSERT INTO businesses (
  id, name, short_name, slug, tagline, description, logo_url,
  initials, accent_color, currency, currency_symbol, locale, timezone, time_format,
  phone, email, address, booking_lead_time_hours, slot_interval_minutes, max_booking_days_ahead,
  social_instagram, social_twitter, social_whatsapp
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Pyaladea Academic Consult',
  'Pyaladea',
  'pyaladea',
  'Empowering Academic Excellence & Personalised Growth',
  'Premium academic consulting, admissions strategy, and subject-matter tutoring for ambitious students in Lagos and beyond.',
  NULL,
  'PC',
  '#7C3AED',
  'NGN',
  '₦',
  'en-NG',
  'Africa/Lagos',
  '12h',
  '+234 812 345 6789',
  'hello@pyaladea.com',
  '14 Victoria Island Way, Suite 3B, Lagos, Nigeria',
  1,
  30,
  60,
  'https://instagram.com/pyaladea_consult',
  'https://twitter.com/pyaladea',
  'https://wa.me/2348123456789'
) ON CONFLICT (slug) DO NOTHING;

-- 2. SEED ADMIN PROFILE
INSERT INTO admin_profiles (
  id, business_id, full_name, email, role
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Deji Ayomide',
  'admin@bookme.app',
  'BUSINESS_ADMIN'
) ON CONFLICT (id) DO NOTHING;

-- 3. SEED BUSINESS HOURS
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

-- 4. SEED SERVICES
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
  ),
  (
    '11111111-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Group Study Workshop',
    'A 60-minute interactive group session for up to 5 students focusing on exam techniques and collaborative learning.',
    60, 0, 8000.00, TRUE, '👥', 'group'
  ),
  (
    '11111111-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'Exam Prep Intensive',
    'A focused 75-minute targeted preparation session for WAEC, JAMB, SAT, or other competitive examinations.',
    75, 15, 18000.00, FALSE, '✏️', 'exam'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  is_active = EXCLUDED.is_active;

-- 5. SEED CUSTOMERS
INSERT INTO customers (id, business_id, first_name, last_name, email, phone, notes)
VALUES
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Amara', 'Okonkwo', 'amara.o@gmail.com', '+234 813 456 7890', 'Preparing for JAMB 2026. Very motivated student.'),
  ('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Emeka', 'Nwosu', 'emeka.nwosu@yahoo.com', '+234 802 987 6543', 'Parent-referred. Needs help with Maths and English.'),
  ('22222222-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Fatima', 'Aliyu', 'f.aliyu@outlook.com', '+234 907 123 4567', ''),
  ('22222222-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Chidi', 'Eze', 'chidi.eze@gmail.com', '+234 816 234 5678', 'SAT prep. Targeting 1400+.'),
  ('22222222-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Ngozi', 'Adeyemi', 'ngozi.a@gmail.com', '+234 803 345 6789', 'SS3 student, WAEC focus.'),
  ('22222222-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Tunde', 'Bakare', 'tunde.b@gmail.com', '+234 814 567 8901', ''),
  ('22222222-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Adaeze', 'Uchenna', 'adaeze.u@yahoo.com', '+234 909 678 9012', 'Long-term client. Excellent progress in Sciences.'),
  ('22222222-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Babatunde', 'Olatunde', 'bb.olatunde@gmail.com', '+234 805 789 0123', ''),
  ('22222222-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Kemi', 'Adeleke', 'kemi.adeleke@gmail.com', '+234 811 890 1234', 'Group sessions preferred.'),
  ('22222222-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Oluwaseun', 'Fasanya', 'seun.fasanya@gmail.com', '+234 807 901 2345', 'Parent books on their behalf.')
ON CONFLICT (business_id, email) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone;

-- 6. SEED SAMPLE BOOKINGS
INSERT INTO service_bookings (
  booking_reference, business_id, service_id, customer_id,
  booking_date, start_time, end_time, starts_at, ends_at,
  status, payment_status, amount, currency, customer_notes
) VALUES
  (
    'BKM-8K2L', '00000000-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001',
    CURRENT_DATE, '10:00', '11:30',
    (CURRENT_DATE + TIME '10:00') AT TIME ZONE 'Africa/Lagos',
    (CURRENT_DATE + TIME '11:30') AT TIME ZONE 'Africa/Lagos',
    'CONFIRMED', 'PAID', 25000.00, 'NGN', 'First consultation'
  ),
  (
    'BKM-3P9X', '00000000-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002',
    CURRENT_DATE, '14:00', '14:45',
    (CURRENT_DATE + TIME '14:00') AT TIME ZONE 'Africa/Lagos',
    (CURRENT_DATE + TIME '14:45') AT TIME ZONE 'Africa/Lagos',
    'CONFIRMED', 'PAID', 10000.00, 'NGN', ''
  ),
  (
    'BKM-7T4W', '00000000-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003',
    CURRENT_DATE + INTERVAL '1 day', '09:00', '09:30',
    (CURRENT_DATE + INTERVAL '1 day' + TIME '09:00') AT TIME ZONE 'Africa/Lagos',
    (CURRENT_DATE + INTERVAL '1 day' + TIME '09:30') AT TIME ZONE 'Africa/Lagos',
    'PENDING', 'UNPAID', 0.00, 'NGN', 'Referred by Emeka'
  ),
  (
    'BKM-2M6R', '00000000-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000004',
    CURRENT_DATE + INTERVAL '3 day', '10:00', '12:00',
    (CURRENT_DATE + INTERVAL '3 day' + TIME '10:00') AT TIME ZONE 'Africa/Lagos',
    (CURRENT_DATE + INTERVAL '3 day' + TIME '12:00') AT TIME ZONE 'Africa/Lagos',
    'CONFIRMED', 'PAID', 45000.00, 'NGN', 'Full assessment, SAT focus'
  )
ON CONFLICT (booking_reference) DO NOTHING;

-- 7. SEED SAMPLE BLOCKED DATES
INSERT INTO blocked_dates (business_id, blocked_date, reason)
VALUES
  ('00000000-0000-0000-0000-000000000001', CURRENT_DATE + INTERVAL '4 day', 'Public Holiday'),
  ('00000000-0000-0000-0000-000000000001', CURRENT_DATE + INTERVAL '11 day', 'Staff Training Day'),
  ('00000000-0000-0000-0000-000000000001', CURRENT_DATE + INTERVAL '18 day', 'Scheduled Maintenance')
ON CONFLICT DO NOTHING;
