-- ============================================================================
-- 20261023 — Business Edit Invoice (document layer over finalized business bills)
--
-- A finalized Purchase Booking / Sales Booking / Local Purchase / Local Sales
-- bill can produce one or more EDITABLE business/document invoices (Commercial
-- Invoice, Proforma, Export Invoice, Packing List) whose Unit Price / Document
-- Value / consignee / notify / destination / shipping fields may legitimately
-- differ from the accounting record for customer / bank / shipping / customs
-- paperwork.
--
-- HARD RULE — this module NEVER writes back to the source. There are NO triggers
-- on purchase_orders / sales_orders / local_purchases here. The original
-- transaction, Debit/Credit, Journal, Ledger, Roznamcha, Stock Cost, Payment,
-- Outstanding Balance and postings are completely untouched. This is a pure
-- read-from-source, write-own-tables document layer.
--
-- NOT connected to Customs / Clearing Agent / Shipping Line / Shipping Agent
-- modules or their permissions — a business module only.
-- ============================================================================

create sequence if not exists public.business_edit_invoice_no_seq;

create table if not exists public.business_edit_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,                         -- BEI-YYYYMMDD-NNNNN

  -- ── audit link to the ORIGINAL finalized bill (read-only reference) ──
  source_module text not null
    check (source_module in ('purchase_booking','sales_booking','local_purchase','local_sales')),
  source_id uuid not null,
  source_table text not null,
  original_bill_no text,
  original_manual_bill_no text,
  original_bill_date date,
  original_currency text,
  original_exchange_rate numeric,
  original_total_value numeric,                            -- frozen from the source

  -- ── document / editable header ──
  doc_type text not null default 'commercial_invoice'
    check (doc_type in ('commercial_invoice','proforma_invoice','export_invoice','packing_list')),
  document_no text,                                        -- optional user-facing doc number
  document_date date default (now() at time zone 'UTC')::date,
  document_currency text,
  document_exchange_rate numeric,
  document_total_value numeric,                            -- the edited total

  -- ── scope + company/branch branding link ──
  country_id uuid references public.countries(id),
  country_branch_id uuid references public.country_branches(id),
  city_branch_id uuid references public.city_branches(id),
  company_id uuid references public.companies(id),

  -- ── auto-filled party (editable) ──
  txn_kind text not null default 'purchase' check (txn_kind in ('purchase','sales')),
  trade_scope text not null default 'local' check (trade_scope in ('local','international')),
  party_name text,
  party_details jsonb not null default '{}'::jsonb,        -- address/phone/email/taxId/country
  consignee jsonb,
  notify_party jsonb,
  seller jsonb,
  buyer jsonb,

  -- ── shipping / document details (editable, free-form) ──
  destination text,
  incoterms text,
  payment_terms text,
  transport jsonb,                                         -- mode/vessel/ports/BL/containers...
  bank jsonb,
  reference_nos jsonb not null default '{}'::jsonb,
  notes text,
  validity text,
  signature_name text,
  header_fields jsonb not null default '{}'::jsonb,        -- any extra template fields

  original_language_code text not null default 'en'
    check (original_language_code in ('en','ur','ps','fa','ar')),

  status text not null default 'draft' check (status in ('draft','finalized','void')),
  version_no int not null default 1,

  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_bei_source     on public.business_edit_invoices (source_module, source_id);
create index if not exists idx_bei_scope      on public.business_edit_invoices (country_id, city_branch_id);
create index if not exists idx_bei_created_at on public.business_edit_invoices (created_at desc);

create table if not exists public.business_edit_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.business_edit_invoices(id) on delete cascade,
  sort_order int not null default 0,
  goods_name text,
  description text,
  hs_code text,
  brand text,
  size text,
  packing text,
  packages numeric,
  quantity numeric,
  unit text,
  net_weight numeric,
  gross_weight numeric,
  -- original values (frozen from the source bill — for the audit panel)
  original_unit_price numeric,
  original_amount numeric,
  -- document / editable values
  document_unit_price numeric,
  document_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_bei_lines_invoice on public.business_edit_invoice_lines (invoice_id, sort_order);

-- immutable version snapshots — never overwrite an issued document
create table if not exists public.business_edit_invoice_versions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.business_edit_invoices(id) on delete cascade,
  version_no int not null,
  snapshot jsonb not null,                                 -- full header + lines at that point
  document_total_value numeric,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  note text,
  unique (invoice_id, version_no)
);
create index if not exists idx_bei_versions_invoice on public.business_edit_invoice_versions (invoice_id, version_no desc);

create table if not exists public.business_edit_invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.business_edit_invoices(id) on delete cascade,
  event_type text not null,                                -- created | edited | finalized | voided | printed | version
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid,
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists idx_bei_events_invoice on public.business_edit_invoice_events (invoice_id, created_at desc);

-- ── invoice_no assignment + updated_at touch ──
create or replace function public.business_edit_invoices_assign_no() returns trigger
language plpgsql as $fn$
begin
  if NEW.invoice_no is null or NEW.invoice_no = '' then
    NEW.invoice_no := 'BEI-' || to_char(now() at time zone 'UTC','YYYYMMDD') || '-' ||
                      lpad(nextval('public.business_edit_invoice_no_seq')::text, 5, '0');
  end if;
  return NEW;
end $fn$;

create or replace function public.business_edit_invoices_touch() returns trigger
language plpgsql as $fn$
begin NEW.updated_at := now(); return NEW; end $fn$;

drop trigger if exists trg_bei_assign_no on public.business_edit_invoices;
create trigger trg_bei_assign_no before insert on public.business_edit_invoices
  for each row execute function public.business_edit_invoices_assign_no();

drop trigger if exists trg_bei_touch on public.business_edit_invoices;
create trigger trg_bei_touch before update on public.business_edit_invoices
  for each row execute function public.business_edit_invoices_touch();

-- seed a 'created' event
create or replace function public.business_edit_invoices_seed_event() returns trigger
language plpgsql as $fn$
begin
  insert into public.business_edit_invoice_events (invoice_id, event_type, detail, actor_id)
  values (NEW.id, 'created',
    jsonb_build_object('source_module', NEW.source_module, 'source_id', NEW.source_id,
                       'original_total_value', NEW.original_total_value, 'doc_type', NEW.doc_type),
    NEW.created_by);
  return NEW;
end $fn$;
drop trigger if exists trg_bei_seed_event on public.business_edit_invoices;
create trigger trg_bei_seed_event after insert on public.business_edit_invoices
  for each row execute function public.business_edit_invoices_seed_event();

do $$ begin
  begin execute 'alter publication supabase_realtime add table public.business_edit_invoices'; exception when others then null; end;
end $$;
