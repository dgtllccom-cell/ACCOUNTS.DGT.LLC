-- Migration: 20261014_bill_expenses.sql
-- Automatic Bill-Expenses linkage for the transaction modules.
--
-- When an eligible source bill (Purchase Booking / Local Purchase / Sales Booking /
-- Local Sales) reaches its posted/confirmed state, it AUTOMATICALLY becomes available
-- in the Bill-Expenses register via a DB trigger — the user never re-creates the
-- original bill. `bill_expenses` only REFERENCES the source transaction
-- (source_module + source_id, UNIQUE) and snapshots its key fields; additional
-- expenses are recorded as separate `bill_expense_lines` linked back to that register
-- row. No duplicate Purchase/Sales transactions are ever created.
--
-- Accounting: `bill_expense_lines` carry optional linkage to the ERP's existing
-- approved posting objects (expense account, roznamcha entry, ledger posting batch).
-- This migration NEVER invents a posting — it only provides the columns that the
-- expense-posting flow fills in when the user posts a line.
--
-- Additive & idempotent.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Register: one row per eligible source bill
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bill_expenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- which module the bill came from, and its id in that module's table
  source_module       text NOT NULL
                        CHECK (source_module IN ('purchase_booking','local_purchase','sales_booking','local_sales')),
  source_id           uuid NOT NULL,
  source_table        text NOT NULL,               -- physical table name, for traceability

  -- reference snapshot taken from the source bill (kept fresh by the sync trigger)
  bill_no             text,                         -- Purchase/Sales Order No.
  manual_bill_no      text,                         -- Manual Bill No. / Contract No.
  bill_date           date,
  transaction_date    date,

  country_id          uuid REFERENCES public.countries(id),
  country_branch_id   uuid REFERENCES public.country_branches(id),
  city_branch_id      uuid REFERENCES public.city_branches(id),

  party_account_no    text,                         -- Purchase / Sales Account No.
  party_name          text,                         -- Supplier / Customer / Party
  party_company_id    uuid,

  currency            text,
  original_bill_amount numeric(18,4) NOT NULL DEFAULT 0,

  -- rollups maintained by the line trigger
  expense_total       numeric(18,4) NOT NULL DEFAULT 0,
  expense_count       integer       NOT NULL DEFAULT 0,

  -- lifecycle
  --   eligibility: 'active'  = source bill is posted/confirmed → shown in the register
  --               'withdrawn' = source bill went back to draft / was cancelled →
  --                             hidden from the working list but the row + its expense
  --                             lines are preserved (never deleted automatically)
  eligibility         text NOT NULL DEFAULT 'active'
                        CHECK (eligibility IN ('active','withdrawn')),
  source_status       text,                         -- raw status snapshot from the source
  status              text NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','closed')),

  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,

  UNIQUE (source_module, source_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_expenses_source     ON public.bill_expenses (source_module, source_id);
CREATE INDEX IF NOT EXISTS idx_bill_expenses_scope      ON public.bill_expenses (country_id, country_branch_id, city_branch_id);
CREATE INDEX IF NOT EXISTS idx_bill_expenses_elig       ON public.bill_expenses (eligibility) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Additional expense lines recorded against a register row
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bill_expense_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_expense_id     uuid NOT NULL REFERENCES public.bill_expenses(id) ON DELETE CASCADE,
  row_serial          integer NOT NULL DEFAULT 1,

  expense_type        text NOT NULL DEFAULT 'other',   -- shipping|loading|clearing|transport|customs|handling|other
  details             text,

  currency            text NOT NULL,
  amount              numeric(18,4) NOT NULL DEFAULT 0,
  exchange_rate       numeric(18,6) NOT NULL DEFAULT 1,
  local_amount        numeric(18,4) NOT NULL DEFAULT 0,
  tax_pct             numeric(9,4)  NOT NULL DEFAULT 0,
  tax_amount          numeric(18,4) NOT NULL DEFAULT 0,
  grand_amount        numeric(18,4) NOT NULL DEFAULT 0,

  -- accounting linkage — filled by the ERP's existing expense-posting flow, never here
  expense_account_id      uuid,
  counter_account_id      uuid,
  roznamcha_entry_id      uuid,
  ledger_posting_batch_id uuid,
  posting_status      text NOT NULL DEFAULT 'unposted'
                        CHECK (posting_status IN ('unposted','posted','void')),
  posted_at           timestamptz,

  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_bill_expense_lines_parent ON public.bill_expense_lines (bill_expense_id) WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. updated_at touch
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bill_expenses_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_bill_expenses_touch ON public.bill_expenses;
CREATE TRIGGER trg_bill_expenses_touch BEFORE UPDATE ON public.bill_expenses
  FOR EACH ROW EXECUTE FUNCTION public.bill_expenses_touch();

DROP TRIGGER IF EXISTS trg_bill_expense_lines_touch ON public.bill_expense_lines;
CREATE TRIGGER trg_bill_expense_lines_touch BEFORE UPDATE ON public.bill_expense_lines
  FOR EACH ROW EXECUTE FUNCTION public.bill_expenses_touch();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Rollup: recompute expense_total / expense_count on the register row
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bill_expense_lines_rollup() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_parent uuid := COALESCE(NEW.bill_expense_id, OLD.bill_expense_id);
BEGIN
  UPDATE public.bill_expenses be SET
    expense_total = COALESCE((SELECT SUM(l.grand_amount) FROM public.bill_expense_lines l
                              WHERE l.bill_expense_id = v_parent AND l.deleted_at IS NULL), 0),
    expense_count = COALESCE((SELECT COUNT(*)             FROM public.bill_expense_lines l
                              WHERE l.bill_expense_id = v_parent AND l.deleted_at IS NULL), 0),
    updated_at    = now()
  WHERE be.id = v_parent;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_bill_expense_lines_rollup ON public.bill_expense_lines;
CREATE TRIGGER trg_bill_expense_lines_rollup
  AFTER INSERT OR UPDATE OR DELETE ON public.bill_expense_lines
  FOR EACH ROW EXECUTE FUNCTION public.bill_expense_lines_rollup();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Auto-registration: one trigger function, attached to every source table.
--    Fires on INSERT/UPDATE, upserts the register row when the bill is eligible,
--    and marks it 'withdrawn' (never deletes) when it falls back to draft/cancelled.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bill_expenses_sync_from_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_module        text;
  v_eligible      boolean := false;
  v_status        text;
  v_bill_no       text;
  v_manual_no     text;
  v_bill_date     date;
  v_txn_date      date;
  v_country       uuid;
  v_cbranch       uuid;
  v_citybranch    uuid;
  v_party_acc     text;
  v_party_name    text;
  v_party_company uuid;
  v_currency      text;
  v_amount        numeric(18,4);
  v_form          jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  IF NEW.deleted_at IS NOT NULL THEN
    UPDATE public.bill_expenses
       SET eligibility = 'withdrawn', source_status = 'deleted', updated_at = now()
     WHERE source_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'purchase_orders' THEN
    v_module     := 'purchase_booking';
    v_status     := COALESCE(NEW.ledger_posting_status, NEW.status);
    v_eligible   := (NEW.ledger_posting_status = 'posted')
                    OR (lower(COALESCE(NEW.status,'')) IN ('posted','booked','confirmed','finalized'));
    v_form       := COALESCE(NEW.form_data, '{}'::jsonb);
    v_bill_no    := NEW.purchase_order_no;
    v_manual_no  := COALESCE(NEW.purchase_contract_no, NULLIF(v_form->'form'->>'manualBillNumber',''),
                             NULLIF(v_form->'form'->>'manualBillNo',''), NULLIF(v_form->'form'->>'billNo',''),
                             NULLIF(v_form->'form'->>'manualReferenceNumber',''));
    v_bill_date  := COALESCE(NULLIF(v_form->'form'->>'orderDate','')::date, NEW.created_at::date);
    v_txn_date   := COALESCE(NULLIF(v_form->'form'->>'transferDate','')::date, NEW.updated_at::date);
    v_country    := NEW.country_id;
    v_cbranch    := NEW.country_branch_id;
    v_citybranch := NEW.city_branch_id;
    v_party_acc  := COALESCE(NULLIF(v_form->'form'->>'purchaseAccountNo',''), NULLIF(v_form->'form'->>'purchaseAccountNumber',''),
                             NULLIF(v_form->'form'->>'supplierAccountNo',''), NULLIF(v_form->'form'->>'purchaseAccountName',''));
    v_party_name := COALESCE(NULLIF(v_form->'form'->>'supplierName',''), NULLIF(v_form->'form'->>'sellerName',''),
                             NULLIF(v_form->'form'->>'purchaseAccountName',''));
    v_party_company := NEW.supplier_company_id;
    v_currency   := COALESCE(NEW.currency_code, NEW.purchase_currency);
    v_amount     := COALESCE(NULLIF(NEW.landed_cost_original,0), NULLIF(NEW.order_total,0),
                             NULLIF((v_form->'totals'->>'grandPrimaryFinal')::numeric,0),
                             NULLIF((v_form->'form'->>'totalAmount')::numeric,0), 0);

  ELSIF TG_TABLE_NAME = 'local_purchases' THEN
    v_module     := 'local_purchase';
    v_status     := NEW.status;
    v_eligible   := lower(COALESCE(NEW.status,'')) IN ('accepted','posted','transferred')
                    OR NEW.transferred_at IS NOT NULL;
    v_bill_no    := COALESCE(NULLIF(NEW.journal_serial_no,''), NULLIF(NEW.manual_bill_no,''));
    v_manual_no  := NEW.manual_bill_no;
    v_bill_date  := COALESCE(NULLIF(NEW.transfer_date,'')::date, NEW.created_at::date);
    v_txn_date   := COALESCE(NEW.transferred_at::date, NEW.accepted_at::date, NEW.updated_at::date);
    v_country    := NEW.country_id;
    v_cbranch    := NEW.country_branch_id;
    v_citybranch := NEW.city_branch_id;
    v_party_acc  := NULLIF(NEW.purchase_account_no,'');
    v_party_name := NULLIF(NEW.supplier_name,'');
    v_party_company := NEW.company_id;
    v_currency   := COALESCE(NEW.purchase_currency, NEW.local_currency);
    v_amount     := COALESCE(NULLIF(NEW.final_cost,0), NULLIF(NEW.purchase_cost,0), 0);

  ELSIF TG_TABLE_NAME = 'sales_orders' THEN
    v_form       := COALESCE(NEW.form_data, '{}'::jsonb);
    -- Local Sales and (export) Sales Booking share the sales_orders table; the sale
    -- type in form_data decides the module label. Default to sales_booking.
    v_module     := CASE
                      WHEN lower(COALESCE(v_form->'form'->>'saleType', v_form->'form'->>'salesType','')) IN ('local','domestic')
                        THEN 'local_sales'
                      ELSE 'sales_booking'
                    END;
    v_status     := COALESCE(NEW.ledger_posting_status, NEW.sales_status);
    v_eligible   := (NEW.ledger_posting_status IN ('transferred','posted'))
                    OR (lower(COALESCE(NEW.sales_status,'')) IN ('confirmed','finalized','posted','completed'));
    v_bill_no    := NEW.sales_order_no;
    v_manual_no  := COALESCE(NULLIF(NEW.sales_contract_no,''), NULLIF(NEW.manual_reference_number,''),
                             NULLIF(v_form->'form'->>'manualBillNumber',''), NULLIF(v_form->'form'->>'billNo',''));
    v_bill_date  := COALESCE(NEW.order_date, NEW.created_at::date);
    v_txn_date   := COALESCE(NULLIF(NEW.transfer_date,'')::date, NEW.updated_at::date);
    v_country    := NEW.country_id;
    v_cbranch    := NEW.country_branch_id;
    v_citybranch := NEW.city_branch_id;
    v_party_acc  := COALESCE(NULLIF(NEW.account_number,''), NULLIF(v_form->'form'->>'customerAccountNo',''),
                             NULLIF(v_form->'form'->>'customerAccountName',''));
    v_party_name := COALESCE(NULLIF(NEW.customer_name,''), NULLIF(v_form->'form'->>'customerName',''),
                             NULLIF(v_form->'form'->>'buyerName',''));
    v_currency   := COALESCE(NEW.currency_code, NEW.original_currency_code);
    v_amount     := COALESCE(NULLIF(NEW.order_total,0), NULLIF(NEW.base_currency_amount,0),
                             NULLIF((v_form->'totals'->>'grandFinal')::numeric,0), 0);
  ELSE
    RETURN NEW;
  END IF;

  IF v_eligible THEN
    INSERT INTO public.bill_expenses (
      source_module, source_id, source_table, bill_no, manual_bill_no, bill_date, transaction_date,
      country_id, country_branch_id, city_branch_id, party_account_no, party_name, party_company_id,
      currency, original_bill_amount, eligibility, source_status, created_by
    ) VALUES (
      v_module, NEW.id, TG_TABLE_NAME, v_bill_no, v_manual_no, v_bill_date, v_txn_date,
      v_country, v_cbranch, v_citybranch, v_party_acc, v_party_name, v_party_company,
      v_currency, COALESCE(v_amount,0), 'active', v_status, NEW.created_by
    )
    ON CONFLICT (source_module, source_id) DO UPDATE SET
      bill_no             = EXCLUDED.bill_no,
      manual_bill_no      = EXCLUDED.manual_bill_no,
      bill_date           = EXCLUDED.bill_date,
      transaction_date    = EXCLUDED.transaction_date,
      country_id          = EXCLUDED.country_id,
      country_branch_id   = EXCLUDED.country_branch_id,
      city_branch_id      = EXCLUDED.city_branch_id,
      party_account_no    = EXCLUDED.party_account_no,
      party_name          = EXCLUDED.party_name,
      party_company_id    = EXCLUDED.party_company_id,
      currency            = EXCLUDED.currency,
      original_bill_amount = EXCLUDED.original_bill_amount,
      eligibility         = 'active',
      source_status       = EXCLUDED.source_status,
      updated_at          = now();
  ELSE
    -- Not (or no longer) eligible: withdraw a prior registration but keep the row + lines.
    UPDATE public.bill_expenses
       SET eligibility = 'withdrawn', source_status = v_status, updated_at = now()
     WHERE source_module = v_module AND source_id = NEW.id;
  END IF;

  RETURN NEW;
END $$;

DO $$
BEGIN
  IF to_regclass('public.purchase_orders') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_bill_expenses_sync ON public.purchase_orders';
    EXECUTE 'CREATE TRIGGER trg_bill_expenses_sync AFTER INSERT OR UPDATE ON public.purchase_orders
             FOR EACH ROW EXECUTE FUNCTION public.bill_expenses_sync_from_source()';
  END IF;
  IF to_regclass('public.local_purchases') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_bill_expenses_sync ON public.local_purchases';
    EXECUTE 'CREATE TRIGGER trg_bill_expenses_sync AFTER INSERT OR UPDATE ON public.local_purchases
             FOR EACH ROW EXECUTE FUNCTION public.bill_expenses_sync_from_source()';
  END IF;
  IF to_regclass('public.sales_orders') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_bill_expenses_sync ON public.sales_orders';
    EXECUTE 'CREATE TRIGGER trg_bill_expenses_sync AFTER INSERT OR UPDATE ON public.sales_orders
             FOR EACH ROW EXECUTE FUNCTION public.bill_expenses_sync_from_source()';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Backfill: replay the sync trigger over every already-eligible source bill so
--    there is exactly ONE extraction code path (the trigger function). A self-
--    assignment fires AFTER UPDATE without changing any data or bumping updated_at.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.purchase_orders') IS NOT NULL THEN
    UPDATE public.purchase_orders SET updated_at = updated_at
     WHERE deleted_at IS NULL
       AND (ledger_posting_status = 'posted'
            OR lower(COALESCE(status,'')) IN ('posted','booked','confirmed','finalized'));
  END IF;
  IF to_regclass('public.local_purchases') IS NOT NULL THEN
    UPDATE public.local_purchases SET updated_at = updated_at
     WHERE deleted_at IS NULL
       AND (lower(COALESCE(status,'')) IN ('accepted','posted','transferred') OR transferred_at IS NOT NULL);
  END IF;
  IF to_regclass('public.sales_orders') IS NOT NULL THEN
    UPDATE public.sales_orders SET updated_at = updated_at
     WHERE deleted_at IS NULL
       AND (ledger_posting_status IN ('transferred','posted')
            OR lower(COALESCE(sales_status,'')) IN ('confirmed','finalized','posted','completed'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS (permissive; API layer enforces country/branch scope like the other reports)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bill_expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_expense_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bill_expenses_auth      ON public.bill_expenses;
DROP POLICY IF EXISTS bill_expense_lines_auth ON public.bill_expense_lines;
CREATE POLICY bill_expenses_auth      ON public.bill_expenses      FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);
CREATE POLICY bill_expense_lines_auth ON public.bill_expense_lines FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261014_bill_expenses', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
