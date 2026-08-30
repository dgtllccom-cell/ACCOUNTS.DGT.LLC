-- Migration: 20261017_bill_expenses_source_delete.sql
-- Bill-Expenses: clean up the register row when its source transaction is hard-deleted.
--
-- 20261014's sync trigger handled INSERT/UPDATE (and soft-delete via NEW.deleted_at)
-- but a real DELETE of the source row left an orphan bill_expenses row with a dangling
-- source_id (and, for a super-admin-scope source, a NULL country_id). This adds DELETE
-- handling and sweeps the existing orphans.
--
-- Additive & idempotent.

BEGIN;

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
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- source transaction removed → drop its register row (lines cascade)
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

DO $$
BEGIN
  IF to_regclass('public.purchase_orders') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_bill_expenses_sync ON public.purchase_orders';
    EXECUTE 'CREATE TRIGGER trg_bill_expenses_sync AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
             FOR EACH ROW EXECUTE FUNCTION public.bill_expenses_sync_from_source()';
  END IF;
  IF to_regclass('public.local_purchases') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_bill_expenses_sync ON public.local_purchases';
    EXECUTE 'CREATE TRIGGER trg_bill_expenses_sync AFTER INSERT OR UPDATE OR DELETE ON public.local_purchases
             FOR EACH ROW EXECUTE FUNCTION public.bill_expenses_sync_from_source()';
  END IF;
  IF to_regclass('public.sales_orders') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_bill_expenses_sync ON public.sales_orders';
    EXECUTE 'CREATE TRIGGER trg_bill_expenses_sync AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders
             FOR EACH ROW EXECUTE FUNCTION public.bill_expenses_sync_from_source()';
  END IF;
END $$;

-- sweep existing orphans (source transaction no longer present)
DELETE FROM public.bill_expenses be
 WHERE be.source_table = 'purchase_orders'
   AND NOT EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = be.source_id);
DELETE FROM public.bill_expenses be
 WHERE be.source_table = 'local_purchases'
   AND NOT EXISTS (SELECT 1 FROM public.local_purchases l WHERE l.id = be.source_id);
DELETE FROM public.bill_expenses be
 WHERE be.source_table = 'sales_orders'
   AND NOT EXISTS (SELECT 1 FROM public.sales_orders s WHERE s.id = be.source_id);

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261017_bill_expenses_source_delete', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
