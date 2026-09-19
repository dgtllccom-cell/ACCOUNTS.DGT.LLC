import { withLocalPg } from "../lib/db/local-postgres";

const REPORTED_ORDER_ID = "4ce229a3-ee0e-4b47-8409-32642199ad79";
const REPORTED_BILL_NO = "AE-001-0001";
const APPROVED_FINAL_AMOUNT = 464887.5000;
const INCORRECT_POSTED_AMOUNT = 1708461.5625;
const OVERSTATED_DIFF = 1243574.0625; // 1,708,461.5625 - 464,887.5000

async function main() {
  const isExecute = process.argv.includes("--execute");
  console.log(`=== RECONCILIATION SCRIPT FOR REPORTED BILL ${REPORTED_BILL_NO} ===`);
  console.log(`Mode: ${isExecute ? "EXECUTE (Applying changes)" : "DRY RUN (Inspection only, pass --execute to apply)"}`);

  await withLocalPg(async (sql) => {
    // 1. Inspect Order
    const orderRows = await sql`
      select id, purchase_order_no, order_total, currency_code, exchange_rate,
             advance_paid, remaining_due, ledger_posting_status, payment_status, form_data
      from purchase_orders
      where id = ${REPORTED_ORDER_ID}::uuid
      limit 1
    `;
    const order = orderRows[0];
    if (!order) {
      console.log(`Order ${REPORTED_BILL_NO} (${REPORTED_ORDER_ID}) not found in the active database.`);
      return;
    }

    console.log("\n1. Order Details:", {
      id: order.id,
      purchase_order_no: order.purchase_order_no,
      order_total: order.order_total,
      currency_code: order.currency_code,
      exchange_rate: order.exchange_rate,
      posting_status: order.ledger_posting_status
    });

    // 2. Inspect Payment
    const paymentRows = await sql`
      select id, amount, currency_code, exchange_rate, base_currency_amount,
             debit_ledger_id, credit_ledger_id, roznamcha_entry_id, status
      from purchase_order_payments
      where purchase_order_id = ${REPORTED_ORDER_ID}::uuid
        and deleted_at is null
      order by created_at desc
    `;
    console.log(`\n2. Found ${paymentRows.length} payment(s):`);
    for (const p of paymentRows) {
      console.log("  Payment:", {
        id: p.id,
        amount: p.amount,
        currency_code: p.currency_code,
        base_currency_amount: p.base_currency_amount,
        exchange_rate: p.exchange_rate,
        roznamcha_entry_id: p.roznamcha_entry_id
      });
    }

    const targetPayment = paymentRows.find(
      (p) => Number(p.base_currency_amount || p.amount) === INCORRECT_POSTED_AMOUNT
    ) || paymentRows[0];

    if (!targetPayment || !targetPayment.roznamcha_entry_id) {
      console.log("No payment with roznamcha_entry_id found to reconcile.");
      return;
    }

    // 3. Inspect Roznamcha Entry & Lines
    const rozRows = await sql`
      select id, journal_no, voucher_no, base_currency_amount, currency_name, status,
             super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number
      from roznamcha_entries
      where id = ${targetPayment.roznamcha_entry_id}::uuid
    `;
    const rozEntry = rozRows[0];
    console.log("\n3. Roznamcha Entry:", rozEntry);

    const lineRows = await sql`
      select id, ledger_id, debit, credit, currency, usd_rate, description
      from roznamcha_lines
      where roznamcha_entry_id = ${targetPayment.roznamcha_entry_id}::uuid
    `;
    console.log(`\n4. Roznamcha Lines (${lineRows.length} lines):`);
    for (const l of lineRows) {
      console.log("  Line:", {
        id: l.id,
        ledger_id: l.ledger_id,
        debit: l.debit,
        credit: l.credit,
        currency: l.currency,
        usd_rate: l.usd_rate
      });
    }

    // 5. Inspect Affected Ledgers
    const debitLine = lineRows.find((l) => Number(l.debit) > 0);
    const creditLine = lineRows.find((l) => Number(l.credit) > 0);

    if (debitLine?.ledger_id && creditLine?.ledger_id) {
      const ledgerRows = await sql`
        select id, code, name, normal_balance
        from ledgers
        where id in (${debitLine.ledger_id}::uuid, ${creditLine.ledger_id}::uuid)
      `;
      console.log("\n5. Affected Ledgers:", ledgerRows);
    }

    if (!isExecute) {
      console.log("\n[DRY RUN COMPLETE] To apply the correction, run:");
      console.log("npx tsx scripts/reconcile_reported_bill_ae001_0001.ts --execute");
      return;
    }

    // 6. Execute atomic reconciliation
    console.log("\nApplying reconciliation in transaction...");
    await sql.begin(async (tx) => {
      // a. Update Roznamcha Lines
      if (debitLine) {
        await tx`
          update roznamcha_lines
          set debit = ${APPROVED_FINAL_AMOUNT},
              currency = 'AED',
              usd_rate = 1
          where id = ${debitLine.id}::uuid
        `;
        console.log(`✓ Updated DR Line ${debitLine.id}: debit set to ${APPROVED_FINAL_AMOUNT} AED`);
      }

      if (creditLine) {
        await tx`
          update roznamcha_lines
          set credit = ${APPROVED_FINAL_AMOUNT},
              currency = 'AED',
              usd_rate = 1
          where id = ${creditLine.id}::uuid
        `;
        console.log(`✓ Updated CR Line ${creditLine.id}: credit set to ${APPROVED_FINAL_AMOUNT} AED`);
      }

      // b. Update Roznamcha Entry
      await tx`
        update roznamcha_entries
        set base_currency_amount = ${APPROVED_FINAL_AMOUNT},
            currency_name = 'AED',
            updated_at = now()
        where id = ${targetPayment.roznamcha_entry_id}::uuid
      `;
      console.log(`✓ Updated Roznamcha Entry ${targetPayment.roznamcha_entry_id}: base_currency_amount set to ${APPROVED_FINAL_AMOUNT} AED`);

      // c. Update Payment Record
      await tx`
        update purchase_order_payments
        set amount = ${APPROVED_FINAL_AMOUNT},
            currency_code = 'AED',
            base_currency_amount = ${APPROVED_FINAL_AMOUNT},
            original_currency_code = 'USD',
            exchange_rate = 3.675,
            updated_at = now()
        where id = ${targetPayment.id}::uuid
      `;
      console.log(`✓ Updated Payment ${targetPayment.id}: amount & base set to ${APPROVED_FINAL_AMOUNT} AED`);

      // d. Update Purchase Order remaining due if needed
      await tx`
        update purchase_orders
        set remaining_due = greatest(0, ${APPROVED_FINAL_AMOUNT} - coalesce(advance_paid, 0)),
            updated_at = now()
        where id = ${REPORTED_ORDER_ID}::uuid
      `;
      console.log(`✓ Updated Purchase Order ${REPORTED_BILL_NO}`);

      // e. Insert Audit Log
      try {
        await tx`
          insert into audit_logs (
            action,
            entity_type,
            entity_id,
            details,
            created_at
          )
          values (
            'RECONCILE_DOUBLE_CONVERSION',
            'purchase_orders',
            ${REPORTED_ORDER_ID},
            ${JSON.stringify({
              billNo: REPORTED_BILL_NO,
              previousAmount: INCORRECT_POSTED_AMOUNT,
              correctedAmount: APPROVED_FINAL_AMOUNT,
              diff: -OVERSTATED_DIFF,
              reason: "Correction of double conversion on transferred purchase booking. DR/CR posted in final approved currency (AED) exactly once.",
              roznamchaEntryId: targetPayment.roznamcha_entry_id,
              paymentId: targetPayment.id,
              reconciledAt: new Date().toISOString()
            })},
            now()
          )
        `;
        console.log(`✓ Audit log inserted successfully.`);
      } catch (auditErr: any) {
        console.log(`Audit log note: ${auditErr.message}`);
      }

      console.log("\n🎉 RECONCILIATION COMPLETED SUCCESSFULLY IN TRANSACTION!");
    });
  });
}

main().catch((err) => {
  console.error("Reconciliation error:", err);
  process.exit(1);
});
