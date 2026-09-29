-- HRM: Face-ID / biometric devices → the EXISTING attendance records (office_attendance) — ADDITIVE.
--
-- office_attendance stays the ONE authoritative attendance store (payroll already reads it).
-- New here, because they are genuinely required:
--   * hr_attendance_devices        — registered devices (per branch) with a hashed push key
--   * hr_attendance_device_events  — raw device punches (staging / audit trail, idempotent)
--   * employees.biometric_id       — the id an employee is enrolled under on the devices
--   * office_attendance.source     — 'manual' | 'device' | 'import' | 'correction' (default manual)
-- Device punches roll up into one office_attendance row per employee per day. A manual /
-- corrected row is never overwritten by a device. No row is deleted or rewritten here.
-- Rollback: DROP TABLE hr_attendance_device_events, hr_attendance_devices;
--           ALTER TABLE employees DROP COLUMN biometric_id; ALTER TABLE office_attendance DROP COLUMN source;

BEGIN;

CREATE TABLE IF NOT EXISTS public.hr_attendance_devices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code       text NOT NULL,
  name              text NOT NULL,
  device_type       text NOT NULL DEFAULT 'face' CHECK (device_type IN ('face', 'fingerprint', 'card', 'mobile', 'other')),
  serial_no         text,
  country_id        uuid NOT NULL REFERENCES public.countries(id),
  country_branch_id uuid REFERENCES public.country_branches(id),
  city_branch_id    uuid REFERENCES public.city_branches(id),
  timezone          text NOT NULL DEFAULT 'Asia/Dubai',
  api_key_hash      text NOT NULL,
  api_key_hint      text,
  is_active         boolean NOT NULL DEFAULT true,
  last_seen_at      timestamptz,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_attendance_devices_code_uq ON public.hr_attendance_devices (lower(device_code)) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hr_attendance_device_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         uuid NOT NULL REFERENCES public.hr_attendance_devices(id),
  biometric_id      text NOT NULL,
  employee_id       uuid REFERENCES public.employees(id),
  event_time        timestamptz NOT NULL,
  event_local_date  date NOT NULL,
  direction         text NOT NULL DEFAULT 'unknown' CHECK (direction IN ('in', 'out', 'unknown')),
  verify_mode       text,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'unmatched', 'ignored_manual', 'ignored_duplicate')),
  attendance_id     uuid REFERENCES public.office_attendance(id),
  source            text NOT NULL DEFAULT 'device' CHECK (source IN ('device', 'import')),
  raw               jsonb,
  country_id        uuid REFERENCES public.countries(id),
  country_branch_id uuid REFERENCES public.country_branches(id),
  city_branch_id    uuid REFERENCES public.city_branches(id),
  processed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
-- Idempotency: the same punch pushed twice is stored once.
CREATE UNIQUE INDEX IF NOT EXISTS hr_attendance_device_events_uq ON public.hr_attendance_device_events (device_id, biometric_id, event_time);
CREATE INDEX IF NOT EXISTS hr_attendance_device_events_emp_day ON public.hr_attendance_device_events (employee_id, event_local_date);
CREATE INDEX IF NOT EXISTS hr_attendance_device_events_status ON public.hr_attendance_device_events (status) WHERE status IN ('pending', 'unmatched');

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS biometric_id text;
CREATE INDEX IF NOT EXISTS employees_biometric_id_idx ON public.employees (country_id, biometric_id) WHERE biometric_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.office_attendance ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'office_attendance_source_chk') THEN
    ALTER TABLE public.office_attendance ADD CONSTRAINT office_attendance_source_chk CHECK (source IN ('manual', 'device', 'import', 'correction'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS office_attendance_emp_date_idx ON public.office_attendance (employee_id, attendance_date) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.hr_attendance_device_events IS 'Raw Face-ID / biometric punches. Rolled up into office_attendance (the authoritative attendance). Never edited by hand.';

COMMIT;
