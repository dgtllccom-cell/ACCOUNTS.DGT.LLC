-- ============================================================================
-- 20261028 — Consignment Stock & Sales Register
--
-- A SEPARATE tracking / register module. It does NOT post to Purchase, Sales,
-- Ledger, Journal, Roznamcha or DR/CR. Container / Expense / Sale / Receipt
-- rows here are informational only. "Transfer / Confirm to Accounting" is a
-- LATER phase (owner-approved rules) — no trigger touches any accounting table.
--
-- Model:
--   consignment                (one register head per Party consignment relationship)
--     └─ consignment_container  (Container No / BL No / Loading Date … — many over time)
--          └─ consignment_container_good  (goods / cartons / qty / weight per container)
--     └─ consignment_expense    (against the consignment or one container)
--     └─ consignment_sale       (goods sold out of the consignment stock)
--     └─ consignment_receipt    (collections received from the Party)
--     └─ consignment_event      (audit / history)
--
-- Reuses existing masters (never duplicated): enterprise_accounts / accounts
-- (Party), customers, goods, product_units, countries, country_branches,
-- city_branches. Country / Branch scoped like every other module.
--
-- Additive & idempotent.
-- ============================================================================

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.consignment_no_seq;

-- ─────────────────────────────────────────────────────────────────────────────
-- consignment  (register head)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignment (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_no     text UNIQUE,

  -- scope
  country_id         uuid REFERENCES public.countries(id),
  country_branch_id  uuid REFERENCES public.country_branches(id),
  city_branch_id     uuid REFERENCES public.city_branches(id),

  -- Party — one of these two links (never duplicated); party_name is the snapshot
  party_account_id   uuid REFERENCES public.enterprise_accounts(id),
  party_customer_id  uuid REFERENCES public.customers(id),
  party_name         text NOT NULL,
  party_contact      text,
  party_phone        text,

  title              text,
  reference_no       text,
  base_currency      text NOT NULL DEFAULT 'USD',
  consignment_date   date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,

  status             text NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','completed','closed','cancelled')),

  -- LATER phase: when accounting confirmation is added
  accounting_status  text NOT NULL DEFAULT 'not_transferred'
                        CHECK (accounting_status IN ('not_transferred','transferred')),
  transferred_at     timestamptz,

  notes              text,
  original_language_code text NOT NULL DEFAULT 'en'
                        CHECK (original_language_code IN ('en','ur','ps','fa','ar')),

  created_by          uuid NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);
CREATE INDEX IF NOT EXISTS idx_consignment_scope
  ON public.consignment (country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_consignment_party_acc
  ON public.consignment (party_account_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_consignment_party_cust
  ON public.consignment (party_customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_consignment_status
  ON public.consignment (status) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- consignment_container
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignment_container (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_id     uuid NOT NULL REFERENCES public.consignment(id) ON DELETE CASCADE,

  container_no       text,
  bl_no              text,
  loading_date       date,
  arrival_date       date,
  vessel_name        text,
  shipping_line      text,
  origin_country_id  uuid REFERENCES public.countries(id),

  seal_no            text,
  total_cartons      numeric,
  total_gross_weight numeric,
  total_net_weight   numeric,

  status             text NOT NULL DEFAULT 'received'
                        CHECK (status IN ('expected','in_transit','received','unloaded','closed')),
  notes              text,

  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cnt_container_consignment
  ON public.consignment_container (consignment_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- consignment_container_good  (goods line per container)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignment_container_good (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id       uuid NOT NULL REFERENCES public.consignment_container(id) ON DELETE CASCADE,
  consignment_id     uuid NOT NULL REFERENCES public.consignment(id) ON DELETE CASCADE,

  goods_id           uuid REFERENCES public.goods(id),
  goods_name         text NOT NULL,           -- snapshot (translatable free text)
  unit_id            uuid REFERENCES public.product_units(id),
  unit_label         text,

  cartons            numeric,
  quantity           numeric NOT NULL DEFAULT 0,
  gross_weight       numeric,
  net_weight         numeric,
  rate               numeric,                 -- informational
  amount             numeric,                 -- informational (rate * quantity)
  currency           text,
  notes              text,

  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cnt_good_container ON public.consignment_container_good (container_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cnt_good_consignment ON public.consignment_container_good (consignment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cnt_good_goods ON public.consignment_container_good (goods_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- consignment_expense
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignment_expense (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_id     uuid NOT NULL REFERENCES public.consignment(id) ON DELETE CASCADE,
  container_id       uuid REFERENCES public.consignment_container(id) ON DELETE SET NULL,

  expense_type       text NOT NULL DEFAULT 'other'
                        CHECK (expense_type IN ('freight','clearing','transport','labour','storage','duty','commission','other')),
  description        text,
  currency           text NOT NULL DEFAULT 'USD',
  amount             numeric NOT NULL DEFAULT 0,
  expense_date       date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  paid_by            text,
  reference_no       text,
  notes              text,

  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cnt_expense_consignment ON public.consignment_expense (consignment_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- consignment_sale
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignment_sale (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_id     uuid NOT NULL REFERENCES public.consignment(id) ON DELETE CASCADE,
  container_id       uuid REFERENCES public.consignment_container(id) ON DELETE SET NULL,

  sale_date          date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  buyer_name         text,
  goods_id           uuid REFERENCES public.goods(id),
  goods_name         text NOT NULL,
  unit_id            uuid REFERENCES public.product_units(id),
  unit_label         text,
  quantity           numeric NOT NULL DEFAULT 0,
  rate               numeric,
  currency           text NOT NULL DEFAULT 'USD',
  amount             numeric NOT NULL DEFAULT 0,
  reference_no       text,
  notes              text,

  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cnt_sale_consignment ON public.consignment_sale (consignment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cnt_sale_goods ON public.consignment_sale (goods_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- consignment_receipt  (collections from the Party)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignment_receipt (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_id     uuid NOT NULL REFERENCES public.consignment(id) ON DELETE CASCADE,

  receipt_date       date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  amount             numeric NOT NULL DEFAULT 0,
  currency           text NOT NULL DEFAULT 'USD',
  method             text NOT NULL DEFAULT 'cash'
                        CHECK (method IN ('cash','bank','cheque','online','adjustment','other')),
  reference_no       text,
  notes              text,

  created_by         uuid NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_cnt_receipt_consignment ON public.consignment_receipt (consignment_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- consignment_event  (audit / history)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consignment_event (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_id uuid NOT NULL REFERENCES public.consignment(id) ON DELETE CASCADE,
  actor_id       uuid,
  actor_name     text,
  event_type     text NOT NULL,
  detail         text,
  meta           jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cnt_event_consignment ON public.consignment_event (consignment_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- triggers: updated_at + consignment_no + guaranteed 'created' history row
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consignment_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_consignment_touch ON public.consignment;
CREATE TRIGGER trg_consignment_touch BEFORE UPDATE ON public.consignment
  FOR EACH ROW EXECUTE FUNCTION public.consignment_touch();
DROP TRIGGER IF EXISTS trg_cnt_container_touch ON public.consignment_container;
CREATE TRIGGER trg_cnt_container_touch BEFORE UPDATE ON public.consignment_container
  FOR EACH ROW EXECUTE FUNCTION public.consignment_touch();
DROP TRIGGER IF EXISTS trg_cnt_good_touch ON public.consignment_container_good;
CREATE TRIGGER trg_cnt_good_touch BEFORE UPDATE ON public.consignment_container_good
  FOR EACH ROW EXECUTE FUNCTION public.consignment_touch();
DROP TRIGGER IF EXISTS trg_cnt_expense_touch ON public.consignment_expense;
CREATE TRIGGER trg_cnt_expense_touch BEFORE UPDATE ON public.consignment_expense
  FOR EACH ROW EXECUTE FUNCTION public.consignment_touch();
DROP TRIGGER IF EXISTS trg_cnt_sale_touch ON public.consignment_sale;
CREATE TRIGGER trg_cnt_sale_touch BEFORE UPDATE ON public.consignment_sale
  FOR EACH ROW EXECUTE FUNCTION public.consignment_touch();
DROP TRIGGER IF EXISTS trg_cnt_receipt_touch ON public.consignment_receipt;
CREATE TRIGGER trg_cnt_receipt_touch BEFORE UPDATE ON public.consignment_receipt
  FOR EACH ROW EXECUTE FUNCTION public.consignment_touch();

CREATE OR REPLACE FUNCTION public.consignment_assign_no() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.consignment_no IS NULL OR NEW.consignment_no = '' THEN
    NEW.consignment_no := 'CNS-' || to_char(now(), 'YYYYMMDD') || '-' ||
                          lpad(nextval('public.consignment_no_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_consignment_assign_no ON public.consignment;
CREATE TRIGGER trg_consignment_assign_no BEFORE INSERT ON public.consignment
  FOR EACH ROW EXECUTE FUNCTION public.consignment_assign_no();

CREATE OR REPLACE FUNCTION public.consignment_seed_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.consignment_event (consignment_id, actor_id, event_type, detail)
  VALUES (NEW.id, NEW.created_by, 'created', NEW.consignment_no);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_consignment_seed_event ON public.consignment;
CREATE TRIGGER trg_consignment_seed_event AFTER INSERT ON public.consignment
  FOR EACH ROW EXECUTE FUNCTION public.consignment_seed_event();

COMMENT ON TABLE public.consignment IS
  'Consignment Stock & Sales Register — tracking only. No accounting posting; Transfer-to-Accounting is a later owner-approved phase.';

COMMIT;
