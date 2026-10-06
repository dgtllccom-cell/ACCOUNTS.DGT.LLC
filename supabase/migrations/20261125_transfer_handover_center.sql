-- Main Transfer & Handover Center — ADDITIVE widening of the EXISTING
-- inter_country_transfers table (the working Incoming/Sent/Pending/Accepted/
-- Rejected engine behind /dashboard/inter-country-transfers).
--
-- This is deliberately NOT a new/duplicate transfer table or a second
-- workflow engine. inter_country_transfers already carries a full
-- source-country/branch + destination-country/branch scope, a status
-- lifecycle, sender/receiver users, and an audit trail — exactly the shape
-- the directive's "Main Transfer & Handover Center / Gmail-style ERP Inbox"
-- needs. This migration:
--   1. Adds a `transfer_type` discriminator so the SAME table can carry
--      non-financial handovers (shipping stage handoffs, truck tasks, goods
--      verification, clearing bills, ...) alongside the existing financial
--      country-to-country claims — every existing row defaults to
--      'financial_claim' so nothing already posted changes meaning.
--   2. Adds 'completed' and 'resubmitted' to the status lifecycle, plus a
--      resubmit chain (resubmitted_from_id / resubmit_count) for the
--      Accept / Return for Correction / Reject / Resubmit workflow.
--   3. Relaxes the financial-only NOT NULL / amount>0 constraints so a
--      non-financial handover (no amount, no currency) can use the same
--      row shape. Every EXISTING financial_claim row already satisfies the
--      new, wider constraints — nothing is tightened.
--   4. Adds a generic polymorphic source_table/source_id pair (the same
--      pattern already used by shipping_expense_transfers) so a later phase
--      can link a handover row back to the shipping/truck/clearing/purchase
--      record that produced it, without a new junction table.
--
-- No new accounting engine: acceptance of a 'financial_claim' row still
-- posts through the existing Roznamcha path exactly as before. Non-financial
-- types only ever touch this table's own status/audit columns.

alter table public.inter_country_transfers
  add column if not exists transfer_type text not null default 'financial_claim',
  add column if not exists source_table text,
  add column if not exists source_id uuid,
  add column if not exists resubmitted_from_id uuid references public.inter_country_transfers(id),
  add column if not exists resubmit_count integer not null default 0,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references public.profiles(id),
  add column if not exists return_reason text;

alter table public.inter_country_transfers
  drop constraint if exists inter_country_transfers_transfer_type_check;
alter table public.inter_country_transfers
  add constraint inter_country_transfers_transfer_type_check
  check (transfer_type in (
    'financial_claim', 'shipping_handover', 'purchase_booking',
    'truck_task', 'goods_verification', 'clearing_bill', 'other'
  ));

-- Widen the status lifecycle: add 'completed' (a terminal state reachable
-- after 'accepted', for handover types that have downstream fulfillment) and
-- 'resubmitted' (marks a row superseded by a newly-created resubmission after
-- it was returned for correction). Every existing row's status
-- (pending/accepted/rejected/returned/cancelled) is still valid.
alter table public.inter_country_transfers
  drop constraint if exists inter_country_transfers_status_check;
alter table public.inter_country_transfers
  add constraint inter_country_transfers_status_check
  check (status in (
    'pending', 'accepted', 'rejected', 'returned', 'cancelled',
    'resubmitted', 'completed'
  ));

-- Relax financial-only requirements so a non-financial handover row can omit
-- amount/currency entirely. Every existing financial_claim row already has
-- these populated, so this only widens what's ALLOWED — it changes no data.
alter table public.inter_country_transfers alter column amount drop not null;
alter table public.inter_country_transfers alter column original_currency drop not null;
alter table public.inter_country_transfers alter column final_currency drop not null;
alter table public.inter_country_transfers alter column final_amount drop not null;

alter table public.inter_country_transfers
  drop constraint if exists inter_country_transfers_amount_check;
alter table public.inter_country_transfers
  add constraint inter_country_transfers_amount_check
  check (amount is null or amount >= 0);

create index if not exists inter_country_transfers_type_idx
  on public.inter_country_transfers (transfer_type, status, created_at desc)
  where deleted_at is null;

create index if not exists inter_country_transfers_source_ref_idx
  on public.inter_country_transfers (source_table, source_id)
  where deleted_at is null and source_table is not null;

create index if not exists inter_country_transfers_resubmit_idx
  on public.inter_country_transfers (resubmitted_from_id)
  where deleted_at is null and resubmitted_from_id is not null;

comment on column public.inter_country_transfers.transfer_type is
  'Discriminator for the Transfer & Handover Center inbox: financial_claim (the original inter-country claim, posts via Roznamcha) or a non-financial handover type (status/audit only).';
comment on column public.inter_country_transfers.source_table is
  'Optional polymorphic link to the record that produced this handover (e.g. shipping_line_records, trucks, purchase_orders) — same convention as shipping_expense_transfers.source_table.';
comment on column public.inter_country_transfers.resubmitted_from_id is
  'When this row was created by resubmitting a returned row, points at the original.';
