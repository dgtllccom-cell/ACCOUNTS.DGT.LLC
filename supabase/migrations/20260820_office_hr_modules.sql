-- General Office HR modules: Attendance, Leave, Office Assets.
-- Direct-Postgres tables (the app authenticates as the Postgres role and enforces scope/RBAC in the
-- API layer via requireErpSession + authorizeApiScope, consistent with the rest of the ERP).

CREATE TABLE IF NOT EXISTS public.office_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  attendance_date date NOT NULL DEFAULT current_date,
  check_in time,
  check_out time,
  status text NOT NULL DEFAULT 'Present',
  work_hours numeric(6,2),
  notes text,
  country_id uuid REFERENCES public.countries(id),
  city_branch_id uuid REFERENCES public.city_branches(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_office_attendance_date ON public.office_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_office_attendance_emp ON public.office_attendance(employee_id);

CREATE TABLE IF NOT EXISTS public.office_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  leave_type text NOT NULL DEFAULT 'Annual',
  from_date date NOT NULL,
  to_date date NOT NULL,
  days numeric(5,1),
  reason text,
  status text NOT NULL DEFAULT 'Pending',
  approved_by uuid,
  country_id uuid REFERENCES public.countries(id),
  city_branch_id uuid REFERENCES public.city_branches(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_office_leave_dates ON public.office_leave_requests(from_date, to_date);
CREATE INDEX IF NOT EXISTS idx_office_leave_emp ON public.office_leave_requests(employee_id);

CREATE TABLE IF NOT EXISTS public.office_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag text,
  asset_name text NOT NULL,
  category text,
  assigned_employee_id uuid REFERENCES public.employees(id),
  serial_number text,
  purchase_date date,
  asset_value numeric(14,2),
  currency text,
  status text NOT NULL DEFAULT 'Available',
  notes text,
  country_id uuid REFERENCES public.countries(id),
  city_branch_id uuid REFERENCES public.city_branches(id),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_office_assets_status ON public.office_assets(status);
CREATE INDEX IF NOT EXISTS idx_office_assets_emp ON public.office_assets(assigned_employee_id);
