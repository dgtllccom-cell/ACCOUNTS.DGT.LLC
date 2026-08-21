import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  console.log("=== APPLYING FIX FOR ROZNAMCHA UNIQUE INDEX & SALES PAYMENT RPC ===");

  // 1. Refine the unique index on roznamcha_entries so it only enforces 1-to-1 on booking transfers
  await sql`DROP INDEX IF EXISTS roznamcha_entries_source_unique_idx;`;
  await sql`
    CREATE UNIQUE INDEX roznamcha_entries_source_unique_idx
      ON roznamcha_entries (source_module, source_transaction_type, source_transaction_id)
      WHERE deleted_at IS NULL 
        AND status <> 'cancelled'::document_status 
        AND source_transaction_id IS NOT NULL
        AND source_transaction_type IN ('purchase_booking_transfer', 'sales_transfer_to_payment', 'sales_booking_transfer');
  `;
  console.log("✅ Updated roznamcha_entries_source_unique_idx to protect booking transfers while allowing multi-installment payments.");

  // 2. Update post_sales_order_payment to support multi-installment kinds and only block duplicate booking transfers
  await sql`
    CREATE OR REPLACE FUNCTION public.post_sales_order_payment(
      p_sales_order_id uuid,
      p_payment_kind text,
      p_entry_date date,
      p_amount numeric,
      p_currency_code text,
      p_exchange_rate numeric,
      p_debit_ledger_id uuid,
      p_credit_ledger_id uuid,
      p_reference_no text,
      p_narration text
    )
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_order sales_orders%rowtype;
      v_payment_id uuid;
      v_roz_type roznamcha_type;
      v_journal text;
      v_voucher text;
      v_entry_id uuid;
      v_lines jsonb;
      v_existing_entry_id uuid;
      v_currency text;
      v_exchange_rate numeric;
      v_base_amount numeric;
      v_reference_no text;
      v_debit_currency text;
      v_credit_currency text;
    BEGIN
      SELECT * INTO v_order
      FROM sales_orders
      WHERE id = p_sales_order_id
        AND deleted_at IS NULL;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order not found';
      END IF;

      -- Idempotency guard: ONLY for 'booking' / initial transfer
      IF p_payment_kind = 'booking' OR p_payment_kind = 'transfer' THEN
        SELECT id INTO v_existing_entry_id
        FROM roznamcha_entries
        WHERE source_module = 'sales'
          AND source_transaction_type IN ('sales_transfer_to_payment', 'sales_booking_transfer')
          AND source_transaction_id = p_sales_order_id
          AND deleted_at IS NULL
          AND status <> 'cancelled'
        LIMIT 1;

        IF v_existing_entry_id IS NOT NULL THEN
          RAISE EXCEPTION 'This sales order has already been posted to Roznamcha (entry %). Duplicate posting is not allowed.', v_existing_entry_id;
        END IF;
      END IF;

      IF p_debit_ledger_id IS NULL OR p_credit_ledger_id IS NULL THEN
        RAISE EXCEPTION 'Debit and credit ledgers are required';
      END IF;

      IF p_debit_ledger_id = p_credit_ledger_id THEN
        RAISE EXCEPTION 'Debit and credit ledgers must be different';
      END IF;

      -- Lookup ledger currencies
      SELECT COALESCE(currency, 'PKR') INTO v_debit_currency FROM ledgers WHERE id = p_debit_ledger_id;
      SELECT COALESCE(currency, 'PKR') INTO v_credit_currency FROM ledgers WHERE id = p_credit_ledger_id;

      v_currency := UPPER(TRIM(COALESCE(p_currency_code, v_order.currency_code, 'USD')));
      v_exchange_rate := CASE WHEN COALESCE(p_exchange_rate, 0) <= 0 THEN 1 ELSE p_exchange_rate END;
      v_base_amount := ROUND(COALESCE(p_amount, 0) * v_exchange_rate, 4);
      v_reference_no := COALESCE(NULLIF(TRIM(p_reference_no), ''), v_order.sales_order_no);

      -- Determine posting type
      v_roz_type := CASE
        WHEN v_order.city_branch_id IS NOT NULL THEN 'branch'::roznamcha_type
        WHEN v_order.country_branch_id IS NOT NULL THEN 'branch'::roznamcha_type
        WHEN v_order.country_id IS NOT NULL THEN 'country'::roznamcha_type
        ELSE 'super_admin'::roznamcha_type
      END;

      v_journal := CONCAT('SO-', TO_CHAR(NOW(), 'YYYYMMDD'), '-', SUBSTR(REPLACE(gen_random_uuid()::text,'-',''),1,6));
      v_voucher := CONCAT('SOPAY-', TO_CHAR(NOW(), 'YYYYMMDD'), '-', SUBSTR(REPLACE(gen_random_uuid()::text,'-',''),1,6));

      v_lines := jsonb_build_array(
        jsonb_build_object(
          'paymentEntryType', 'debit',
          'ledgerId', p_debit_ledger_id,
          'description', COALESCE(NULLIF(TRIM(p_narration), ''), 'Sales payment debit'),
          'debit', v_base_amount,
          'credit', 0,
          'currency', COALESCE(v_debit_currency, v_currency),
          'usdRate', 1
        ),
        jsonb_build_object(
          'paymentEntryType', 'credit',
          'ledgerId', p_credit_ledger_id,
          'description', COALESCE(NULLIF(TRIM(p_narration), ''), 'Sales payment credit'),
          'debit', 0,
          'credit', v_base_amount,
          'currency', COALESCE(v_credit_currency, v_currency),
          'usdRate', 1
        )
      );

      v_entry_id := post_roznamcha_entry(
        v_roz_type,
        v_order.country_id,
        v_order.country_branch_id,
        v_order.city_branch_id,
        v_journal,
        v_voucher,
        p_entry_date,
        NULL::uuid,
        v_reference_no,
        COALESCE(NULLIF(TRIM(p_narration), ''), CONCAT('Sales receipt for ', v_reference_no)),
        v_lines,
        true
      );

      UPDATE roznamcha_entries
      SET
        source_module = 'sales',
        source_transaction_type = CASE p_payment_kind
          WHEN 'booking' THEN 'sales_booking_transfer'
          WHEN 'transfer' THEN 'sales_transfer_to_payment'
          WHEN 'advance' THEN 'sales_advance_payment'
          WHEN 'remaining' THEN 'sales_remaining_payment'
          WHEN 'credit' THEN 'sales_credit_payment'
          ELSE 'sales_payment'
        END,
        source_transaction_id = v_order.id,
        source_reference_no = v_reference_no,
        original_currency_code = v_currency,
        currency_name = v_currency,
        base_currency_amount = v_base_amount,
        entry_category = 'business'
      WHERE id = v_entry_id;

      INSERT INTO sales_order_payments (
        sales_order_id,
        roznamcha_entry_id,
        payment_kind,
        payment_date,
        amount,
        currency_code,
        exchange_rate,
        status,
        remarks,
        created_by,
        created_at
      )
      VALUES (
        p_sales_order_id,
        v_entry_id,
        p_payment_kind,
        p_entry_date,
        p_amount,
        v_currency,
        p_exchange_rate,
        'posted',
        v_reference_no,
        auth.uid(),
        NOW()
      )
      RETURNING id INTO v_payment_id;

      PERFORM recalc_sales_order_payment_totals(p_sales_order_id);

      RETURN v_payment_id;
    END;
    $$;
  `;
  console.log("✅ Updated post_sales_order_payment function to match purchase payment architecture with multi-installment support and balanced roznamcha posting.");

  await sql.end();
}

main().catch(console.error);
