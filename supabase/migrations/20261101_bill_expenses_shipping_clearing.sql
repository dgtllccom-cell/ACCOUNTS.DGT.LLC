-- Migration: 20261101_bill_expenses_shipping_clearing.sql
-- Phase 1 of the "BILL COST, EXPENSES & PROFIT" system.
--
-- Extends the existing bill_expenses auto-registration (20261014 / 20261017) to two more
-- eligible source documents so shipping and clearing bills also flow into the one
-- reusable Expense-Bill register — the user never re-creates the source bill:
--
--   shipping_bl_records   → source_module 'shipping_bl'   (Bill of Lading / container bill)
--   clearing_payment_bills → source_module 'clearing_bill'  (clearing-agent payment bill)
--
-- Also widens the bill_expenses.source_module CHECK. Additive & idempotent — the sync
-- function is a straight extension of 20261017's; the four existing modules are byte-for-
-- byte identical.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Widen the source_module CHECK
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bill_expenses DROP CONSTRAINT IF EXISTS bill_expenses_source_module_check;
ALTER TABLE public.bill_expenses
  ADD CONSTRAINT bill_expenses_source_module_check
  CHECK (source_module IN ('purchase_booking','local_purchase','sales_booking','local_sales','shipping_bl','clearing_bill'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Sync function — 20261017 body + shipping_bl_records + clearing_payment_bills
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bill_expenses_sync_from_source() RETURNS trigger LANGUAGE plpgsql AS $fn$
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
  v_row           jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.bill_expenses WHERE source_id = OLD.id;
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

  ELSIF TG_TABLE_NAME = 'shipping_bl_records' THEN
    -- Bill of Lading / container bill. Eligible once it carries a BL number and is not cancelled.
    v_row        := to_jsonb(NEW);
    v_module     := 'shipping_bl';
    v_status     := COALESCE(v_row->>'shipment_status', 'draft');
    v_eligible   := NULLIF(v_row->>'bl_number','') IS NOT NULL
                    AND lower(COALESCE(v_row->>'shipment_status','draft')) NOT IN ('cancelled','void','deleted');
    v_bill_no    := NULLIF(v_row->>'bl_number','');
    v_manual_no  := COALESCE(NULLIF(v_row->>'container_number',''), NULLIF(v_row->>'voyage_number',''));
    v_bill_date  := COALESCE(NULLIF(v_row->>'etd','')::date, NEW.created_at::date);
    v_txn_date   := COALESCE(NULLIF(v_row->>'eta','')::date, NEW.updated_at::date);
    v_country    := NEW.country_id;
    v_cbranch    := NEW.country_branch_id;
    v_citybranch := NEW.city_branch_id;
    v_party_acc  := NULLIF(v_row->>'account_number','');
    v_party_name := COALESCE(NULLIF(v_row->>'exporter_name',''), NULLIF(v_row->>'importer_name',''),
                             NULLIF(v_row->>'shipping_line_name',''));
    v_party_company := NULL;
    v_currency   := COALESCE(NULLIF(v_row->>'currency_code',''), 'USD');
    v_amount     := COALESCE(NULLIF((v_row->>'debit')::numeric,0), NULLIF((v_row->>'credit')::numeric,0), 0);

  ELSIF TG_TABLE_NAME = 'clearing_payment_bills' THEN
    -- Clearing-agent payment bill. Eligible while it is a live, active bill.
    v_row        := to_jsonb(NEW);
    v_module     := 'clearing_bill';
    v_status     := COALESCE(v_row->>'payment_status', 'pending');
    v_eligible   := COALESCE((v_row->>'is_active')::boolean, true) = true
                    AND lower(COALESCE(v_row->>'status','active')) = 'active';
    v_bill_no    := COALESCE(NULLIF(v_row->>'bill_no',''), NULLIF(v_row->>'gd_number',''));
    v_manual_no  := COALESCE(NULLIF(v_row->>'bl_number',''), NULLIF(v_row->>'order_no',''));
    v_bill_date  := NEW.created_at::date;
    v_txn_date   := NEW.updated_at::date;
    v_country    := NEW.country_id;
    v_cbranch    := NEW.country_branch_id;
    v_citybranch := NEW.city_branch_id;
    v_party_acc  := NULL;
    v_party_name := NULLIF(v_row->>'agent_name','');
    v_party_company := NULL;
    v_currency   := COALESCE(NULLIF(v_row->>'currency_code',''), 'USD');
    v_amount     := COALESCE(NULLIF((v_row->>'total_amount')::numeric,0), 0);

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
    UPDATE public.bill_expenses
       SET eligibility = 'withdrawn', source_status = v_status, updated_at = now()
     WHERE source_module = v_module AND source_id = NEW.id;
  END IF;

  RETURN NEW;
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Triggers on the new source tables (existing 4 unchanged)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.shipping_bl_records') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_bill_expenses_sync ON public.shipping_bl_records';
    EXECUTE 'CREATE TRIGGER trg_bill_expenses_sync AFTER INSERT OR UPDATE OR DELETE ON public.shipping_bl_records
             FOR EACH ROW EXECUTE FUNCTION public.bill_expenses_sync_from_source()';
  END IF;
  IF to_regclass('public.clearing_payment_bills') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_bill_expenses_sync ON public.clearing_payment_bills';
    EXECUTE 'CREATE TRIGGER trg_bill_expenses_sync AFTER INSERT OR UPDATE OR DELETE ON public.clearing_payment_bills
             FOR EACH ROW EXECUTE FUNCTION public.bill_expenses_sync_from_source()';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Back-fill: replay the trigger over every already-eligible shipping / clearing bill
--    (self-assignment fires AFTER UPDATE without changing data or updated_at)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.shipping_bl_records') IS NOT NULL THEN
    UPDATE public.shipping_bl_records SET updated_at = updated_at
     WHERE deleted_at IS NULL AND NULLIF(bl_number,'') IS NOT NULL
       AND lower(COALESCE(shipment_status,'draft')) NOT IN ('cancelled','void','deleted');
  END IF;
  IF to_regclass('public.clearing_payment_bills') IS NOT NULL THEN
    UPDATE public.clearing_payment_bills SET updated_at = updated_at
     WHERE deleted_at IS NULL AND COALESCE(is_active, true) = true
       AND lower(COALESCE(status,'active')) = 'active';
  END IF;
END $$;

-- sweep orphans for the new source tables too
DELETE FROM public.bill_expenses be
 WHERE be.source_table = 'shipping_bl_records'
   AND NOT EXISTS (SELECT 1 FROM public.shipping_bl_records s WHERE s.id = be.source_id);
DELETE FROM public.bill_expenses be
 WHERE be.source_table = 'clearing_payment_bills'
   AND NOT EXISTS (SELECT 1 FROM public.clearing_payment_bills c WHERE c.id = be.source_id);

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261101_bill_expenses_shipping_clearing', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
