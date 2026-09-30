-- ============================================================================
-- 20261222 — WPS payment-result reconciliation loop-back into Payroll Run.
--
-- hr_wps_sif_files/hr_wps_sif_lines already track the OUTGOING submission
-- (what was sent to the bank/WPS agent). Nothing tracked the bank's RESULT —
-- which employees were actually paid vs rejected. This migration adds that,
-- as a new additive table, and loops the real per-employee result back into
-- hr_payroll_run_lines (paid -> the existing accounting-posting path;
-- rejected -> a new 'payment_failed' exception status, no money posted).
--
-- Duplicate-posting protection: UNIQUE(sif_line_id) — the same SIF line can
-- only ever have one recorded result. Re-importing the same bank response
-- file is rejected at the database level, not just in application code.
-- ============================================================================

create table if not exists public.hr_wps_payment_results (
  id uuid primary key default gen_random_uuid(),
  sif_id uuid not null references public.hr_wps_sif_files(id) on delete cascade,
  sif_line_id uuid not null references public.hr_wps_sif_lines(id) on delete cascade,
  payroll_line_id uuid references public.hr_payroll_run_lines(id) on delete set null,
  employee_id uuid references public.employees(id),
  result_status text not null check (result_status in ('paid', 'rejected')),
  result_reason text,
  bank_reference text,
  amount numeric,
  currency text,
  payment_roznamcha_id uuid,
  recorded_by uuid,
  recorded_by_name text,
  created_at timestamptz not null default now(),
  constraint hr_wps_payment_results_sif_line_uidx unique (sif_line_id)
);

create index if not exists hr_wps_payment_results_sif_idx
  on public.hr_wps_payment_results (sif_id);
create index if not exists hr_wps_payment_results_payroll_line_idx
  on public.hr_wps_payment_results (payroll_line_id);

alter table public.hr_payroll_run_lines
  add column if not exists payment_failure_reason text;

comment on table public.hr_wps_payment_results is
  'Real per-employee WPS payment outcome reported back by the bank/WPS agent, reconciled against the payroll run. One row per SIF line, ever (unique constraint) — the real duplicate-posting protection.';
