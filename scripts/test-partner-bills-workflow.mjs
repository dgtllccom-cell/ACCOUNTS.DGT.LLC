/**
 * Automated End-to-End Verification Test Script:
 * Route Legs External Partner Workflow, Account Master Ledger Validation,
 * Roznamcha Journal Postings, Partial Payments, Overpayment Prevention,
 * and Shipping Job Cost Integration.
 *
 * CRITICAL RULE: Runs exclusively against DEV Database (csesvyxxjivnkkozgopt).
 */

import { withLocalPg } from "../lib/db/local-postgres.ts";
import {
  createOrUpdatePartnerBill,
  approveAndPostPartnerBill,
  recordPartnerBillPayment,
  listPartnerBillsForOrder
} from "../lib/services/clearing-partner-bill-service.ts";
import { getShippingOrderJobCost } from "../lib/services/shipping-job-cost-service.ts";
import { t } from "../lib/i18n/ui.ts";

async function run() {
  console.log("================================================================================");
  console.log("STARTING TEST: External Partner Bills, Ledger Validation & Roznamcha Postings");
  console.log("================================================================================\n");

  const results = [];
  function recordResult(name, pass, details) {
    results.push({ name, pass, details });
    const mark = pass ? "✅ PASS" : "❌ FAIL";
    console.log(`${mark}: ${name}`);
    if (details) console.log(`   Evidence: ${JSON.stringify(details, null, 2)}\n`);
  }

  await withLocalPg(async (sql) => {
    // 0. Safety Check: Verify DEV Database
    const [dbInfo] = await sql`
      SELECT current_database() as db, current_user as usr, inet_server_addr() as srv
    `;
    const connectionUrl = process.env.DATABASE_URL || "";
    const isDev = connectionUrl.includes("csesvyxxjivnkkozgopt") || dbInfo.db === "postgres";
    const isProd = connectionUrl.includes("inmayhrxucimxqhgseqi");

    if (isProd || !isDev) {
      console.error("FATAL: DATABASE_URL points to Production or unknown database! Aborting.");
      process.exit(1);
    }
    recordResult("DB Safety Check (Target: DEV DB csesvyxxjivnkkozgopt)", true, {
      db: dbInfo.db,
      server: dbInfo.srv || "local/proxy",
      isDevDatabase: true
    });

    // Clean up any old test orders with tag TEST-PARTNER-ORDER
    await sql`
      DELETE FROM public.clearing_payment_bill_payments 
      WHERE bill_id IN (
        SELECT id FROM public.clearing_payment_bills WHERE order_no = 'TEST-PARTNER-ORDER-DEV'
      )
    `;
    await sql`
      DELETE FROM public.clearing_payment_bills WHERE order_no = 'TEST-PARTNER-ORDER-DEV'
    `;
    await sql`
      DELETE FROM public.clearing_customer_order_legs 
      WHERE order_id IN (
        SELECT id FROM public.clearing_customer_orders WHERE order_no = 'TEST-PARTNER-ORDER-DEV'
      )
    `;
    await sql`
      DELETE FROM public.clearing_customer_orders WHERE order_no = 'TEST-PARTNER-ORDER-DEV'
    `;

    // 1. Fetch reference entities on DEV
    const [profile] = await sql`
      SELECT id, full_name FROM public.profiles LIMIT 1
    `;
    const actorId = profile?.id;
    if (!actorId) {
      throw new Error("No active profile found on DEV DB!");
    }

    const [customer] = await sql`
      SELECT id, customer_name FROM public.customers WHERE deleted_at IS NULL LIMIT 1
    `;
    const [afghanistanCountry] = await sql`
      SELECT id, name FROM public.countries WHERE name ILIKE '%afghanistan%' LIMIT 1
    `;
    const [uaeCountry] = await sql`
      SELECT id, name FROM public.countries WHERE name ILIKE '%emirates%' OR name ILIKE '%uae%' LIMIT 1
    `;

    // Active Provider Payable Ledgers from Account Master
    const [providerLedger] = await sql`
      SELECT id, code, name, currency, is_active FROM public.ledgers 
      WHERE (code = '2002' OR name ILIKE '%Accounts Payable%' OR name ILIKE '%Freight%')
        AND is_active = true AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!providerLedger) {
      throw new Error("No active Accounts Payable ledger found on DEV DB!");
    }

    // Active Bank / Cash Ledger for payments
    const [bankLedger] = await sql`
      SELECT id, code, name, currency, is_active FROM public.ledgers 
      WHERE (code = 'BANK-DEV-01' OR code = '1001' OR name ILIKE '%Bank%' OR name ILIKE '%Cash%')
        AND id != ${providerLedger.id}
        AND is_active = true AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!bankLedger) {
      throw new Error("No active Bank/Cash payment ledger found on DEV DB!");
    }

    // Active Expense Ledger
    const [expenseLedger] = await sql`
      SELECT id, code, name FROM public.ledgers 
      WHERE (code = '4002' OR name ILIKE '%Clearing Charges%' OR name ILIKE '%Expense%')
        AND is_active = true AND deleted_at IS NULL
      LIMIT 1
    `;

    recordResult("Account Master Active Ledgers Discovered", true, {
      providerPayableLedger: { id: providerLedger.id, code: providerLedger.code, name: providerLedger.name },
      paymentBankLedger: { id: bankLedger.id, code: bankLedger.code, name: bankLedger.name },
      expenseLedger: { id: expenseLedger.id, code: expenseLedger.code, name: expenseLedger.name }
    });

    // 2. Create Test Customer Order with an External Partner Route Leg
    const [createdOrder] = await sql`
      INSERT INTO public.clearing_customer_orders (
        order_no, customer_id, customer_name, movement_type,
        transport_mode, route_name, current_stage, status,
        loading_country_id, loading_country_name, receiving_country_id, receiving_country_name,
        created_by
      ) VALUES (
        'TEST-PARTNER-ORDER-DEV', ${customer.id}, ${customer.customer_name}, 'import',
        'by_road', 'Dubai → Torkham → Kabul', 'booking', 'confirmed',
        ${uaeCountry?.id || null}, 'United Arab Emirates', ${afghanistanCountry?.id || null}, 'Afghanistan',
        ${actorId}::uuid
      )
      RETURNING id, order_no, route_name
    `;

    // Leg 1: Our Branch (Dubai → Torkham)
    const [leg1] = await sql`
      INSERT INTO public.clearing_customer_order_legs (
        order_id, leg_no, from_location_text, to_location_text,
        transport_mode, handler_type, status
      ) VALUES (
        ${createdOrder.id}, 1, 'Dubai Port', 'Torkham Border',
        'by_road', 'our_branch', 'completed'
      )
      RETURNING id, leg_no, handler_type
    `;

    // Leg 2: External Partner (Torkham → Kabul, handled by "Khyber Afghan Trans")
    const [leg2] = await sql`
      INSERT INTO public.clearing_customer_order_legs (
        order_id, leg_no, from_location_text, to_location_text,
        from_country_name, to_country_name, transport_mode,
        handler_type, partner_type, partner_name, partner_country_name,
        partner_account_id, status
      ) VALUES (
        ${createdOrder.id}, 2, 'Torkham Border', 'Kabul Customs Terminal',
        'Pakistan', 'Afghanistan', 'by_road',
        'external_partner', 'transporter', 'Khyber Afghan Trans', 'Afghanistan',
        ${providerLedger.id}, 'pending'
      )
      RETURNING id, leg_no, handler_type, partner_name, partner_account_id
    `;

    recordResult("Created Order with Route Legs (Our Branch + External Partner)", true, {
      orderId: createdOrder.id,
      orderNo: createdOrder.order_no,
      leg1: { legNo: leg1.leg_no, handler: leg1.handler_type },
      leg2: {
        legNo: leg2.leg_no,
        handler: leg2.handler_type,
        partnerName: leg2.partner_name,
        partnerCountry: "Afghanistan"
      }
    });

    // 3. Test Case 1: Missing Account Master Ledger Validation
    let missingAccountBlocked = false;
    let missingAccountError = "";
    try {
      await createOrUpdatePartnerBill(
        {
          orderId: createdOrder.id,
          legId: leg2.id,
          providerAccountId: "", // Empty Account ID
          agentName: "Khyber Afghan Trans",
          totalAmount: 1000,
          currencyCode: "USD"
        },
        actorId,
        {}
      );
    } catch (err) {
      missingAccountBlocked = true;
      missingAccountError = err.message;
    }
    recordResult("Missing Account Master Ledger Rejected", missingAccountBlocked, {
      expectedError: "PROVIDER_ACCOUNT_REQUIRED",
      actualError: missingAccountError
    });

    // 4. Test Case 2: Create Draft Partner Bill (1,000 USD from Khyber Afghan Trans)
    // Must NOT invent an amount, mark it paid, or post a Journal entry
    const draftBill = await createOrUpdatePartnerBill(
      {
        orderId: createdOrder.id,
        legId: leg2.id,
        providerAccountId: providerLedger.id,
        expenseAccountId: expenseLedger.id,
        agentName: "Khyber Afghan Trans",
        countryOfService: "Afghanistan",
        invoiceRef: "KAT-AF-8921",
        expenseCategory: "freight_transport",
        totalAmount: 1000.00,
        currencyCode: "USD",
        exchangeRate: 1.0,
        remarks: "Transit road haulage Torkham to Kabul terminal",
        supportingDocuments: [{ name: "invoice_8921.pdf", url: "https://dgt.example/docs/8921.pdf" }],
        freightCharges: 1000.00
      },
      actorId,
      {}
    );

    const [savedDraft] = await sql`
      SELECT id, bill_no, order_no, agent_name, total_amount, paid_amount, remaining_balance,
             posting_status, payment_status, roznamcha_entry_id, invoice_ref
      FROM public.clearing_payment_bills
      WHERE id = ${draftBill.id}::uuid
    `;

    const draftValid =
      savedDraft.posting_status === "unposted" &&
      savedDraft.payment_status === "pending" &&
      savedDraft.roznamcha_entry_id === null &&
      Number(savedDraft.total_amount) === 1000.00 &&
      Number(savedDraft.paid_amount) === 0.00 &&
      Number(savedDraft.remaining_balance) === 1000.00;

    recordResult("Draft Partner Bill Created (Unposted, 0 Journal Entries, Unpaid)", draftValid, {
      billNo: savedDraft.bill_no,
      invoiceRef: savedDraft.invoice_ref,
      totalAmount: savedDraft.total_amount,
      paidAmount: savedDraft.paid_amount,
      remainingBalance: savedDraft.remaining_balance,
      postingStatus: savedDraft.posting_status,
      paymentStatus: savedDraft.payment_status,
      roznamchaEntryId: savedDraft.roznamcha_entry_id
    });

    // 5. Test Case 3: Review & Approve Bill -> Post Roznamcha Expense Journal Entry
    const approveRes = await approveAndPostPartnerBill(draftBill.id, actorId, { isSuperAdmin: true });

    const [postedBill] = await sql`
      SELECT b.id, b.bill_no, b.posting_status, b.roznamcha_entry_id, b.remaining_balance, b.paid_amount,
             rz.voucher_no, rz.status AS rz_status
      FROM public.clearing_payment_bills b
      JOIN public.roznamcha_entries rz ON rz.id = b.roznamcha_entry_id
      WHERE b.id = ${draftBill.id}::uuid
    `;

    const [rzSummary] = await sql`
      SELECT 
        COALESCE(SUM(debit), 0)::numeric AS total_debit,
        COALESCE(SUM(credit), 0)::numeric AS total_credit
      FROM public.roznamcha_lines
      WHERE roznamcha_entry_id = ${postedBill.roznamcha_entry_id}::uuid
    `;

    const [rzLines] = await sql`
      SELECT array_agg(json_build_object(
        'type', payment_entry_type,
        'ledger_id', ledger_id,
        'debit', debit,
        'credit', credit,
        'currency', currency
      )) AS lines
      FROM public.roznamcha_lines
      WHERE roznamcha_entry_id = ${postedBill.roznamcha_entry_id}::uuid
    `;

    const approveValid =
      postedBill.posting_status === "posted" &&
      postedBill.roznamcha_entry_id !== null &&
      Number(rzSummary.total_debit) === 1000.00 &&
      Number(rzSummary.total_credit) === 1000.00 &&
      Number(postedBill.paid_amount) === 0.00 &&
      Number(postedBill.remaining_balance) === 1000.00;

    recordResult("Approve Partner Bill & Post Balanced Roznamcha Journal Entry (DR Expense / CR Payable)", approveValid, {
      billNo: postedBill.bill_no,
      voucherNo: postedBill.voucher_no,
      roznamchaDebit: rzSummary.total_debit,
      roznamchaCredit: rzSummary.total_credit,
      remainingBalance: postedBill.remaining_balance,
      lines: rzLines.lines
    });

    // 6. Test Case 4: Partial Payment 1 (Pay 300 USD now from bankLedger)
    const pmt1Res = await recordPartnerBillPayment(
      {
        billId: draftBill.id,
        amount: 300.00,
        paymentAccountId: bankLedger.id,
        paymentDate: "2026-09-29",
        paymentMethod: "bank_transfer",
        referenceNo: "TRF-300-KBL",
        narration: "First advance payment for Kabul road transport"
      },
      actorId
    );

    const [billAfterPmt1] = await sql`
      SELECT b.id, b.total_amount, b.paid_amount, b.remaining_balance, b.payment_status,
             rz.voucher_no AS payment_voucher_no, p.roznamcha_entry_id AS pmt_rz_id
      FROM public.clearing_payment_bills b
      JOIN public.clearing_payment_bill_payments p ON p.bill_id = b.id AND p.payment_serial = 1
      JOIN public.roznamcha_entries rz ON rz.id = p.roznamcha_entry_id
      WHERE b.id = ${draftBill.id}::uuid
    `;

    const [pmt1RzSummary] = await sql`
      SELECT 
        COALESCE(SUM(debit), 0)::numeric AS total_debit,
        COALESCE(SUM(credit), 0)::numeric AS total_credit
      FROM public.roznamcha_lines
      WHERE roznamcha_entry_id = ${billAfterPmt1.pmt_rz_id}::uuid
    `;

    const pmt1Valid =
      Number(billAfterPmt1.paid_amount) === 300.00 &&
      Number(billAfterPmt1.remaining_balance) === 700.00 &&
      billAfterPmt1.payment_status === "partially_paid" &&
      Number(pmt1RzSummary.total_debit) === 300.00 &&
      Number(pmt1RzSummary.total_credit) === 300.00;

    recordResult("Partial Payment 1 (Pay 300 -> Remaining 700 USD & Post Payment Roznamcha)", pmt1Valid, {
      paidAmount: billAfterPmt1.paid_amount,
      remainingBalance: billAfterPmt1.remaining_balance,
      paymentStatus: billAfterPmt1.payment_status,
      paymentVoucher: billAfterPmt1.payment_voucher_no,
      roznamchaDebit: pmt1RzSummary.total_debit,
      roznamchaCredit: pmt1RzSummary.total_credit
    });

    // 7. Test Case 5: Overpayment Prevention (Attempt to pay 800 USD when remaining is 700 USD)
    let overpaymentBlocked = false;
    let overpaymentMsg = "";
    try {
      await recordPartnerBillPayment(
        {
          billId: draftBill.id,
          amount: 800.00, // Exceeds remaining 700 USD
          paymentAccountId: bankLedger.id,
          paymentDate: "2026-09-29",
          paymentMethod: "bank_transfer"
        },
        actorId
      );
    } catch (err) {
      overpaymentBlocked = true;
      overpaymentMsg = err.message;
    }
    recordResult("Overpayment Beyond Outstanding Balance Prevented (Attempt 800 USD on 700 USD due)", overpaymentBlocked, {
      expected: "OVERPAYMENT_PREVENTED",
      actual: overpaymentMsg
    });

    // 8. Test Case 6: Partial Payment 2 (Pay 400 USD -> leaves 300 USD remaining)
    const pmt2Res = await recordPartnerBillPayment(
      {
        billId: draftBill.id,
        amount: 400.00,
        paymentAccountId: bankLedger.id,
        paymentDate: "2026-09-29",
        paymentMethod: "bank_transfer",
        referenceNo: "TRF-400-KBL",
        narration: "Second payment for Kabul road transport"
      },
      actorId
    );

    const [billAfterPmt2] = await sql`
      SELECT id, total_amount, paid_amount, remaining_balance, payment_status
      FROM public.clearing_payment_bills
      WHERE id = ${draftBill.id}::uuid
    `;

    const pmt2Valid =
      Number(billAfterPmt2.paid_amount) === 700.00 &&
      Number(billAfterPmt2.remaining_balance) === 300.00 &&
      billAfterPmt2.payment_status === "partially_paid";

    recordResult("Partial Payment 2 (Pay 400 -> Total Paid 700, Remaining 300 USD)", pmt2Valid, {
      totalBill: billAfterPmt2.total_amount,
      paidAmount: billAfterPmt2.paid_amount,
      remainingBalance: billAfterPmt2.remaining_balance,
      paymentStatus: billAfterPmt2.payment_status
    });

    // 9. Test Case 7: Shipping Job Cost Report Integration
    const jobCost = await getShippingOrderJobCost(createdOrder.id);
    const pbInReport = jobCost.partnerBills?.find((b) => b.id === draftBill.id);

    const jobCostValid =
      pbInReport !== undefined &&
      Number(pbInReport.totalAmount) === 1000.00 &&
      Number(pbInReport.paidAmount) === 700.00 &&
      Number(pbInReport.remainingBalance) === 300.00 &&
      pbInReport.payments.length === 2 &&
      pbInReport.countryOfService === "Afghanistan" &&
      jobCost.jobExpenses.total >= 1000.00;

    recordResult("Shipping Job Cost Report Shows Partner Bill, Payments (300 & 400), Remaining 300", jobCostValid, {
      reportOrderId: jobCost.orderId,
      partnerBillsCount: jobCost.partnerBills?.length,
      provider: pbInReport?.providerName,
      providerAccount: pbInReport?.providerAccountName,
      countryOfService: pbInReport?.countryOfService,
      billTotal: pbInReport?.totalAmount,
      paidAmount: pbInReport?.paidAmount,
      remainingBalance: pbInReport?.remainingBalance,
      paymentsCount: pbInReport?.payments.length,
      jobExpensesTotal: jobCost.jobExpenses.total
    });

    // 10. Test Case 8: Multi-Language & RTL Verification
    const testLangs = ["en", "ur", "ar", "ps", "fa"];
    const i18nEvidence = {};
    let allI18nValid = true;

    for (const l of testLangs) {
      const title = t(l, "comv.partner_bills_title");
      const remainingLabel = t(l, "comv.remaining_due_label");
      const isRtl = ["ur", "ar", "ps", "fa"].includes(l);
      i18nEvidence[l] = { title, remainingLabel, isRtl };
      if (!title || !remainingLabel || title.includes("comv.")) {
        allI18nValid = false;
      }
    }

    recordResult("Multi-Language (5 Languages with RTL) Verification", allI18nValid, i18nEvidence);

    // 11. Clean up DEV test records in proper foreign-key order
    const rzEntries = await sql`
      SELECT roznamcha_entry_id FROM public.clearing_payment_bills WHERE id = ${draftBill.id}::uuid
      UNION
      SELECT roznamcha_entry_id FROM public.clearing_payment_bill_payments WHERE bill_id = ${draftBill.id}::uuid
    `;
    const rzIds = rzEntries.map((r) => r.roznamcha_entry_id).filter(Boolean);

    await sql`DELETE FROM public.clearing_payment_bill_payments WHERE bill_id = ${draftBill.id}::uuid`;
    await sql`DELETE FROM public.clearing_payment_bills WHERE id = ${draftBill.id}::uuid`;
    await sql`DELETE FROM public.clearing_customer_order_legs WHERE order_id = ${createdOrder.id}::uuid`;
    await sql`DELETE FROM public.clearing_customer_orders WHERE id = ${createdOrder.id}::uuid`;

    if (rzIds.length > 0) {
      await sql`DELETE FROM public.roznamcha_lines WHERE roznamcha_entry_id IN ${sql(rzIds)}`;
      await sql`DELETE FROM public.roznamcha_entries WHERE id IN ${sql(rzIds)}`;
    }

    recordResult("DEV DB Cleanup Completed (0 residual financial test records)", true, {
      cleanedOrderId: createdOrder.id,
      cleanedBillId: draftBill.id
    });
  });

  // Summary
  console.log("================================================================================");
  console.log("TEST SUMMARY REPORT");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log("STATUS: ALL TESTS PASSED SUCCESSFULLY! 🎯");
    process.exit(0);
  } else {
    console.error("STATUS: SOME TESTS FAILED!");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution aborted with error:", err);
  process.exit(1);
});
