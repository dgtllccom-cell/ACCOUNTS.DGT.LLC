-- Inter-country / inter-branch Shipping expense/bill transfer workflow — ADDITIVE.
--
-- This is an APPROVAL/hand-off record, NOT a second Roznamcha. On acceptance it posts into the
-- EXISTING Roznamcha/Journal/Ledger engine (postRoznamchaWithErpSession) using the receiving
-- office's own CoA ledger selections (no hard-coded DR/CR). Flow:
--   source shipping bill/expense -> create transfer (pending at destination)
--   -> destination reviews -> Accept (idempotent post) or Reject/Return
--   -> existing DR/CR posting -> existing Ledger.
--
-- Reuses the existing transfer PATTERN (app/api/erp/expenses/transfer) + the existing accounting
-- engine + clearing_agents master. No new customer/company/bank/ledger master, no second cashbook.

create table if not exists shipping_expense_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text not null,                         -- common transfer/reference number (both sides)

  -- Source (origin) bill/expense being transferred.
  source_table text not null,                        -- e.g. 'expenses_bills', 'shipping_line_records'
  source_id uuid not null,
  source_reference_no text,
  source_ledger_id uuid references ledgers(id),

  -- Shipping relationship carried across the transfer.
  clearing_agent_id uuid references clearing_agents(id),

  -- Origin scope.
  origin_country_id uuid references countries(id),
  origin_country_branch_id uuid references country_branches(id),
  origin_city_branch_id uuid references city_branches(id),

  -- Destination (receiving) scope — where the pending incoming transfer appears.
  dest_country_id uuid references countries(id),
  dest_country_branch_id uuid references country_branches(id),
  dest_city_branch_id uuid references city_branches(id),

  -- Financial detail (one underlying transaction; not five copies).
  amount numeric(18,4) not null check (amount >= 0),
  currency_code text not null,
  exchange_rate numeric(18,6) not null default 1 check (exchange_rate > 0),
  category text,
  bl_reference text,                                 -- BL / GR / shipment / job reference
  supporting_document text,

  -- Workflow + audit.
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'returned', 'cancelled')),
  accepted_roznamcha_entry_id uuid references roznamcha_entries(id),  -- idempotency + audit link
  accepted_debit_ledger_id uuid references ledgers(id),
  accepted_credit_ledger_id uuid references ledgers(id),
  decision_note text,
  created_by uuid references profiles(id),
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists shipping_expense_transfers_no_idx
  on shipping_expense_transfers (transfer_no) where deleted_at is null;
create index if not exists shipping_expense_transfers_dest_idx
  on shipping_expense_transfers (dest_country_id, dest_country_branch_id, dest_city_branch_id, status, created_at desc)
  where deleted_at is null;
create index if not exists shipping_expense_transfers_agent_idx
  on shipping_expense_transfers (clearing_agent_id) where clearing_agent_id is not null and deleted_at is null;
create index if not exists shipping_expense_transfers_source_idx
  on shipping_expense_transfers (source_table, source_id) where deleted_at is null;

-- Idempotency backstop: at most ONE accepted posting per transfer (a partial unique index on the
-- roznamcha entry link means a second accept cannot attach a second posting).
create unique index if not exists shipping_expense_transfers_one_posting_idx
  on shipping_expense_transfers (id) where accepted_roznamcha_entry_id is not null and deleted_at is null;

alter table shipping_expense_transfers enable row level security;

-- Read scope: super admin; destination OR origin country/branch match; the assigned clearing agent
-- for a shipping-only login; or the creator/decider. Mirrors the existing scope helpers.
drop policy if exists shipping_expense_transfers_scope_read on shipping_expense_transfers;
create policy shipping_expense_transfers_scope_read on shipping_expense_transfers
  for select using (
    is_super_admin()
    or (is_shipping_scoped_user() and clearing_agent_id is not null and can_access_clearing_agent(clearing_agent_id))
    or (not is_shipping_scoped_user() and (
        (dest_country_id is not null and can_access_country(dest_country_id))
        or (dest_country_branch_id is not null and can_access_country_branch(dest_country_branch_id))
        or (dest_city_branch_id is not null and can_access_city_branch(dest_city_branch_id))
        or (origin_country_id is not null and can_access_country(origin_country_id))
        or (origin_country_branch_id is not null and can_access_country_branch(origin_country_branch_id))
        or (origin_city_branch_id is not null and can_access_city_branch(origin_city_branch_id))
    ))
    or created_by = auth.uid()
    or decided_by = auth.uid()
  );

insert into permissions (resource, action, description)
values
  ('shipping_transfers', 'create', 'Create an inter-country/branch shipping expense transfer'),
  ('shipping_transfers', 'read', 'View incoming/outgoing shipping expense transfers'),
  ('shipping_transfers', 'approve', 'Accept or reject an incoming shipping expense transfer')
on conflict (resource, action) do nothing;
