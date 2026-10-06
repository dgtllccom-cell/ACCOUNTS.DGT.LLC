-- =============================================================================
-- HRM Phase 10 — Onboarding / Offboarding checklists
-- Migration: 20260924_hr_onboarding.sql
--
--   * hr_checklist_templates  — the configurable onboarding / offboarding task list
--   * hr_employee_checklist    — per-employee instance of each task with status
--   * hr_employee_checklist_v  — joined view with employee + progress
--   * hr_seed_employee_checklist(employee_id, phase) — create the task rows for
--                                                      an employee from the template
--
-- Non-destructive: 2 tables + 1 view + 1 function + standard seed.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.hr_checklist_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase         text NOT NULL CHECK (phase IN ('onboarding','offboarding')),
  category      text NOT NULL,
  task_name     text NOT NULL,
  description   text,
  is_mandatory  boolean NOT NULL DEFAULT true,
  responsible   text NOT NULL DEFAULT 'hr' CHECK (responsible IN ('hr','it','finance','manager','employee','admin')),
  rank_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  country_id    uuid REFERENCES public.countries(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_checklist_tmpl_uidx
  ON public.hr_checklist_templates (phase, lower(task_name), coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.hr_employee_checklist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  phase         text NOT NULL CHECK (phase IN ('onboarding','offboarding')),
  category      text NOT NULL,
  task_name     text NOT NULL,
  responsible   text,
  is_mandatory  boolean NOT NULL DEFAULT true,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','not_applicable')),
  due_date      date,
  done_by       uuid,
  done_at       timestamptz,
  notes         text,
  country_id    uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  city_branch_id uuid REFERENCES public.city_branches(id) ON DELETE SET NULL,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS hr_emp_checklist_uidx
  ON public.hr_employee_checklist (employee_id, phase, lower(task_name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS hr_emp_checklist_scope_idx ON public.hr_employee_checklist (country_id, city_branch_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.hr_checklist_templates IS 'Configurable onboarding / offboarding task list.';
COMMENT ON TABLE public.hr_employee_checklist IS 'Per-employee onboarding / offboarding task instances with completion state.';

INSERT INTO public.hr_checklist_templates (phase, category, task_name, responsible, is_mandatory, rank_order) VALUES
  ('onboarding','Documentation','Collect signed employment contract','hr',true,10),
  ('onboarding','Documentation','Verify passport / national ID / visa','hr',true,20),
  ('onboarding','Documentation','Collect bank account / IBAN details','finance',true,30),
  ('onboarding','KYC','Complete employee KYC checklist','hr',true,40),
  ('onboarding','IT','Create email + system accounts','it',true,50),
  ('onboarding','IT','Assign laptop / equipment','it',false,60),
  ('onboarding','Finance','Set up payroll record + salary currency','finance',true,70),
  ('onboarding','Orientation','Company orientation + policies briefing','manager',true,80),
  ('onboarding','Orientation','Introduce reporting manager + team','manager',false,90),
  ('onboarding','Access','Issue employee ID card','admin',false,100),
  ('offboarding','Clearance','Manager confirms last working date + handover','manager',true,10),
  ('offboarding','Clearance','Knowledge transfer / handover document','employee',true,20),
  ('offboarding','IT','Revoke system + email access','it',true,30),
  ('offboarding','IT','Return laptop / equipment / assets','employee',true,40),
  ('offboarding','Finance','Calculate final settlement + gratuity','finance',true,50),
  ('offboarding','Finance','Clear outstanding salary advances','finance',true,60),
  ('offboarding','HR','Exit interview','hr',false,70),
  ('offboarding','HR','Issue experience / relieving letter','hr',true,80),
  ('offboarding','Access','Collect employee ID card + building access','admin',true,90)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.hr_seed_employee_checklist(p_employee_id uuid, p_phase text, p_actor uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE v_n int; v_country uuid; v_city uuid;
BEGIN
  SELECT country_id, city_branch_id INTO v_country, v_city FROM public.employees WHERE id = p_employee_id;
  INSERT INTO public.hr_employee_checklist
    (employee_id, phase, category, task_name, responsible, is_mandatory, country_id, city_branch_id, created_by)
  SELECT p_employee_id, t.phase, t.category, t.task_name, t.responsible, t.is_mandatory, v_country, v_city, p_actor
  FROM public.hr_checklist_templates t
  WHERE t.deleted_at IS NULL AND t.is_active AND t.phase = p_phase
    AND (t.country_id IS NULL OR t.country_id = v_country)
  ON CONFLICT (employee_id, phase, lower(task_name)) WHERE deleted_at IS NULL DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE VIEW public.hr_employee_checklist_v AS
SELECT ec.*,
       e.employee_code,
       COALESCE(c.customer_name, c.company_name, e.employee_code) AS employee_name,
       co.name AS country_name
FROM public.hr_employee_checklist ec
JOIN public.employees e ON e.id = ec.employee_id
LEFT JOIN public.customers c ON c.id = e.person_master_id
LEFT JOIN public.countries co ON co.id = ec.country_id
WHERE ec.deleted_at IS NULL;

GRANT SELECT ON public.hr_employee_checklist_v TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.hr_checklist_templates, public.hr_employee_checklist TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hr_seed_employee_checklist(uuid, text, uuid) TO authenticated, service_role;

INSERT INTO public.erp_schema_migrations (name, status)
  VALUES ('20260924_hr_onboarding', 'applied')
  ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = NOW();

COMMIT;

NOTIFY pgrst, 'reload schema';
