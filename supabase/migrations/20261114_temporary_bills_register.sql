-- ============================================================================
-- 20261114 — Temporary Purchase & Sales Bills Register
--
-- A SEPARATE, TEMPORARY / HISTORICAL tracking register. It is NOT main ERP
-- accounting. It has NO relationship to Ledger / Roznamcha / Journal / DR-CR /
-- Receivable-Payable / Purchase posting / Sales posting / Stock / Vouchers.
--
--   * No accounting columns, no accounting_status, no "transfer to Main ERP".
--   * No trigger writes to any accounting/stock/voucher table.
--   * The main ERP is used ONLY as the source for selecting existing master data
--     (Party / Account from enterprise_accounts|customers, Goods from goods).
--
-- Model (deliberately flat — one row per bill):
--   temp_bill
--     bill_kind          purchase | sale
--     party_*            link to an existing master + a name snapshot
--     reference_no       the Party's account / reference number (a Party may have many)
--     bill_no            the temporary bill / reference number
--     goods_id + goods_name
--     container_no / bl_no   optional
--     bill_date, quantity, weight_cartons, unit, rate, amount, currency_code, remarks
--
-- "Party -> one/many reference numbers -> many bills" is a GROUP BY at query
-- time; reference_no lives on each bill, so no extra table is needed.
--
-- Additive & idempotent.
-- ============================================================================

BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.temp_bill_no_seq;

CREATE TABLE IF NOT EXISTS public.temp_bill (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no           text UNIQUE,                       -- internal auto number (TB-000001)

  bill_kind          text NOT NULL
                       CHECK (bill_kind IN ('purchase','sale')),

  -- scope (country / branch), same shape as every other module
  country_id         uuid REFERENCES public.countries(id),
  country_branch_id  uuid REFERENCES public.country_branches(id),
  city_branch_id     uuid REFERENCES public.city_branches(id),

  -- Party — link ONE existing master (never duplicated); party_name is the snapshot
  party_account_id   uuid REFERENCES public.enterprise_accounts(id),
  party_customer_id  uuid REFERENCES public.customers(id),
  party_name         text NOT NULL,
  reference_no       text,                              -- the Party's account/reference number

  -- Goods — link the existing master where possible; goods_name is the snapshot
  goods_id           uuid REFERENCES public.goods(id),
  goods_name         text,

  bill_no            text,                              -- Bill / Reference No
  container_no       text,                              -- optional
  bl_no              text,                              -- optional
  bill_date          date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,

  quantity           numeric(20,4),
  weight_cartons     numeric(20,4),
  unit               text,                              -- kg / carton / bag / ton / pcs …
  rate               numeric(20,4),
  amount             numeric(20,4),
  currency_code      text NOT NULL DEFAULT 'USD',

  remarks            text,

  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_temp_bill_party_acct  ON public.temp_bill (party_account_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_temp_bill_party_cust  ON public.temp_bill (party_customer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_temp_bill_ref         ON public.temp_bill (reference_no)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_temp_bill_kind_date   ON public.temp_bill (bill_kind, bill_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_temp_bill_goods       ON public.temp_bill (goods_id)          WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_temp_bill_scope       ON public.temp_bill (country_id, country_branch_id, city_branch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_temp_bill_billno      ON public.temp_bill (bill_no)           WHERE deleted_at IS NULL;

-- updated_at touch (the ONLY trigger — nothing accounting-related)
CREATE OR REPLACE FUNCTION public.temp_bill_touch() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_temp_bill_touch ON public.temp_bill;
CREATE TRIGGER trg_temp_bill_touch BEFORE UPDATE ON public.temp_bill
  FOR EACH ROW EXECUTE FUNCTION public.temp_bill_touch();

-- auto entry_no (TB-000001) on insert when not supplied
CREATE OR REPLACE FUNCTION public.temp_bill_assign_no() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entry_no IS NULL OR NEW.entry_no = '' THEN
    NEW.entry_no := 'TB-' || lpad(nextval('public.temp_bill_no_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_temp_bill_assign_no ON public.temp_bill;
CREATE TRIGGER trg_temp_bill_assign_no BEFORE INSERT ON public.temp_bill
  FOR EACH ROW EXECUTE FUNCTION public.temp_bill_assign_no();

COMMENT ON TABLE public.temp_bill IS
  'Temporary Purchase & Sales Bills Register — historical tracking only. NOT main ERP accounting. No ledger/roznamcha/journal/stock/voucher relationship, no accounting transfer.';

COMMIT;
