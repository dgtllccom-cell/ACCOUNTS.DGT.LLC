-- ============================================================================
-- 20261221 — Real CRM sales pipeline stage on customer_inquiries.
--
-- customer_inquiries.status already models the DATA-ENTRY / confirmation
-- workflow (new -> ai_draft -> confirmed -> in_progress -> follow_up ->
-- customer_approved -> converted / closed / lost). That is a different concern
-- from a SALES pipeline (how close is this lead to closing). This migration
-- adds pipeline_stage as a new, additive column so both can coexist without
-- disturbing any existing code that reads `status`.
--
-- Additive & idempotent. Never deletes or overwrites any existing inquiry data
-- — the one-time UPDATE below only ever SETS the new pipeline_stage column,
-- derived from each row's own pre-existing status/lost_reason/converted_at.
-- ============================================================================

alter table public.customer_inquiries
  add column if not exists pipeline_stage text
    check (pipeline_stage in ('new_lead','contacted','qualified','quotation_sent','negotiation','won','lost'))
    default 'new_lead',
  add column if not exists pipeline_stage_updated_at timestamptz not null default now(),
  add column if not exists quotation_sent_at timestamptz,
  add column if not exists quotation_value numeric,
  add column if not exists quotation_currency text;

comment on column public.customer_inquiries.pipeline_stage is
  'Real sales-pipeline stage (New Lead / Contacted / Qualified / Quotation Sent / Negotiation / Won / Lost) — separate from `status`, which tracks the data-entry/confirmation workflow.';

-- Real, auditable trail of every pipeline-stage change (mirrors the existing
-- customer_inquiry_events pattern used for `status` changes).
create table if not exists public.customer_inquiry_pipeline_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.customer_inquiries(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  note text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now()
);

create index if not exists customer_inquiry_pipeline_events_inquiry_idx
  on public.customer_inquiry_pipeline_events (inquiry_id);

create index if not exists customer_inquiries_pipeline_stage_idx
  on public.customer_inquiries (pipeline_stage)
  where deleted_at is null;

-- One-time backfill: derive a starting pipeline_stage for every EXISTING inquiry
-- from its own current status / lost_reason / converted_at. No column already
-- holding real data is touched or overwritten.
update public.customer_inquiries
   set pipeline_stage = case
         when status in ('new', 'ai_draft') then 'new_lead'
         when status in ('confirmed', 'in_progress', 'follow_up') then 'contacted'
         when status = 'customer_approved' then 'qualified'
         when status = 'converted' then 'won'
         when status = 'lost' then 'lost'
         when status = 'closed' and lost_reason is not null then 'lost'
         when status = 'closed' then 'won'
         else 'new_lead'
       end,
       pipeline_stage_updated_at = coalesce(converted_at, closed_at, updated_at, now())
 where deleted_at is null;

-- Seed one pipeline event per inquiry recording this one-time backfill, so the
-- audit trail has a real starting point rather than an unexplained first value.
insert into public.customer_inquiry_pipeline_events (inquiry_id, from_stage, to_stage, note, created_at)
select id, null, pipeline_stage, 'Backfilled from existing status on pipeline migration 20261221', now()
from public.customer_inquiries
where deleted_at is null;
