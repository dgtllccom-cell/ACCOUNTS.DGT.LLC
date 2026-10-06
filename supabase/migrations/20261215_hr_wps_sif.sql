-- HRM: UAE WPS & SIF — the final stage of the EXISTING payroll run (hr_payroll_runs) — ADDITIVE.
--
-- An approved / posted / paid payroll run is validated against the UAE Wage Protection System
-- rules and turned into a Salary Information File (SIF: EDR employee lines + one SCR control line).
-- The SIF is downloaded and uploaded by the employer to its WPS agent (bank / exchange house);
-- the ERP does NOT transmit it. The submission register records the agent's outcome.
--   * hr_wps_establishments — MOHRE establishment id + employer agent routing code, per company
--   * employees.wps_*        — employee person id (labour card), agent routing code, IBAN / account
--   * hr_wps_sif_files       — one generated SIF per run (idempotent), status workflow
--   * hr_wps_sif_lines       — the EDR lines exactly as written in the file
--   * hr_wps_sif_events      — append-only audit
-- No payroll, accounting or bank record is altered here.
-- Rollback: DROP TABLE hr_wps_sif_events, hr_wps_sif_lines, hr_wps_sif_files, hr_wps_establishments;
--           ALTER TABLE employees DROP COLUMN wps_person_id, DROP COLUMN wps_routing_code, DROP COLUMN wps_iban, DROP COLUMN wps_establishment_id;

BEGIN;

CREATE TABLE IF NOT EXISTS public.hr_wps_establishments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES public.companies(id),
  country_id            uuid NOT NULL REFERENCES public.countries(id),
  country_branch_id     uuid REFERENCES public.country_branches(id),
  city_branch_id        uuid REFERENCES public.city_branches(id),
  establishment_id      text NOT NULL,          -- MOHRE employer unique id (13 digits)
  employer_routing_code text NOT NULL,          -- WPS agent routing code of the employer's bank (9 digits)
  agent_name            text,
  employer_reference    text,
  is_active             boolean NOT NULL DEFAULT true,
  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  CONSTRAINT hr_wps_establishments_estab_chk CHECK (establishment_id ~ '^[0-9]{13}$'),
  CONSTRAINT hr_wps_establishments_routing_chk CHECK (employer_routing_code ~ '^[0-9]{9}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_wps_establishments_uq ON public.hr_wps_establishments (establishment_id) WHERE deleted_at IS NULL;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS wps_person_id text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS wps_routing_code text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS wps_iban text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS wps_establishment_id uuid REFERENCES public.hr_wps_establishments(id);

CREATE TABLE IF NOT EXISTS public.hr_wps_sif_files (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_no             text NOT NULL,
  run_id              uuid NOT NULL REFERENCES public.hr_payroll_runs(id),
  establishment_id    uuid NOT NULL REFERENCES public.hr_wps_establishments(id),
  salary_month        text NOT NULL,            -- MMYYYY, as written in the SCR line
  period_start        date NOT NULL,
  period_end          date NOT NULL,
  file_name           text NOT NULL,
  content             text NOT NULL,
  content_sha256      text NOT NULL,
  edr_count           int NOT NULL,
  total_amount        numeric(18,2) NOT NULL,
  currency            text NOT NULL DEFAULT 'AED',
  status              text NOT NULL DEFAULT 'generated'
                      CHECK (status IN ('generated','downloaded','submitted','accepted','rejected','partially_paid','paid','cancelled')),
  submission_reference text,
  submitted_at        timestamptz,
  submitted_by        uuid,
  agent_response      text,
  validation          jsonb NOT NULL DEFAULT '{}'::jsonb,
  country_id          uuid REFERENCES public.countries(id),
  country_branch_id   uuid REFERENCES public.country_branches(id),
  city_branch_id      uuid REFERENCES public.city_branches(id),
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_wps_sif_files_no_uq ON public.hr_wps_sif_files (file_no);
-- Idempotency: one live SIF per payroll run (cancel / reject before generating a replacement).
CREATE UNIQUE INDEX IF NOT EXISTS hr_wps_sif_files_run_live_uq ON public.hr_wps_sif_files (run_id) WHERE status NOT IN ('cancelled','rejected');
CREATE INDEX IF NOT EXISTS hr_wps_sif_files_status_idx ON public.hr_wps_sif_files (status);

CREATE TABLE IF NOT EXISTS public.hr_wps_sif_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sif_id            uuid NOT NULL REFERENCES public.hr_wps_sif_files(id) ON DELETE CASCADE,
  employee_id       uuid NOT NULL REFERENCES public.employees(id),
  payroll_line_id   uuid REFERENCES public.hr_payroll_run_lines(id),
  person_id         text NOT NULL,
  routing_code      text NOT NULL,
  account           text NOT NULL,
  days_in_period    int NOT NULL,
  fixed_amount      numeric(18,2) NOT NULL,
  variable_amount   numeric(18,2) NOT NULL,
  leave_days        int NOT NULL DEFAULT 0,
  line_no           int NOT NULL
);
CREATE INDEX IF NOT EXISTS hr_wps_sif_lines_sif_idx ON public.hr_wps_sif_lines (sif_id, line_no);

CREATE TABLE IF NOT EXISTS public.hr_wps_sif_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sif_id      uuid NOT NULL REFERENCES public.hr_wps_sif_files(id) ON DELETE CASCADE,
  action      text NOT NULL,
  from_status text,
  to_status   text,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id    uuid,
  actor_name  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hr_wps_sif_events_sif_idx ON public.hr_wps_sif_events (sif_id, created_at DESC);

COMMENT ON TABLE public.hr_wps_sif_files IS 'UAE WPS Salary Information Files generated from approved payroll runs. Transmission to the WPS agent is done by the employer outside the ERP; this is the submission register.';

COMMIT;
