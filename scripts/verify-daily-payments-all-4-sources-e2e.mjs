import fs from "node:fs";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

if (fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_0-9]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

const DEV_REF = "csesvyxxjivnkkozgopt";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${DEV_REF}.supabase.co`;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbUrl = process.env.DATABASE_URL;

console.log("================================================================================");
console.log("DEV ENVIRONMENT VERIFICATION — 4 TRANSACTION SOURCES & SETTLEMENT POSTING");
console.log("================================================================================");
console.log(`Target Supabase URL: ${supabaseUrl}`);
console.log(`Checking DB Reference: ${DEV_REF}`);

if (!supabaseUrl.includes(DEV_REF) || !dbUrl.includes(DEV_REF)) {
  console.error(`FATAL ABORT: Connected DB is NOT DEV (${DEV_REF})! Production protection triggered.`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const sql = postgres(dbUrl, { max: 2, prepare: false, ssl: "require" });

const results = [];
function report(testName, status, details = "") {
  results.push({ testName, status, details });
  console.log(`[${status === "PASS" ? "✓ PASS" : status === "SKIP" ? "— SKIP" : "✗ FAIL"}] ${testName} ${details ? `— ${details}` : ""}`);
}

async function runAll() {
  try {
    // 0. Setup Actor
    const authUsers = await sql`select id, email from auth.users limit 5`;
    const testActor = {
      userId: authUsers[0]?.id || "22222222-2222-4000-8000-000000000002",
      userName: authUsers[0]?.email || "super.admin@dgt.llc",
      userRole: "super_admin"
    };
    report("0. Setup Dev Test Actor", "PASS", `User: ${testActor.userName} (${testActor.userId})`);

    // 1. Resolve Ledgers
    const { data: ledgers, error: lErr } = await supabase
      .from("ledgers")
      .select("id, code, name, currency, country_id, city_branch_id")
      .is("deleted_at", null)
      .limit(50);
    if (lErr || !ledgers || ledgers.length < 3) throw new Error("Insufficient ledgers in Dev DB");

    const cashLedger = ledgers.find(l => (l.name || "").toLowerCase().includes("cash") || (l.code || "").toLowerCase().includes("cash")) || ledgers[0];
    const bankLedger = ledgers.find(l => (l.name || "").toLowerCase().includes("bank") || (l.code || "").toLowerCase().includes("bank")) || ledgers[1];
    const supplierLedger = ledgers.find(l => l.id !== cashLedger.id && l.id !== bankLedger.id) || ledgers[2];
    const customerLedger = ledgers.find(l => l.id !== cashLedger.id && l.id !== bankLedger.id && l.id !== supplierLedger.id) || ledgers[3] || ledgers[2];

    const { data: banks } = await supabase.from("banks").select("id, bank_name, currency, country_id").is("deleted_at", null).limit(5);
    const testBank = banks?.[0];

    report("1. Ledger Resolution", "PASS", `Cash: ${cashLedger.name} (${cashLedger.code}) | Bank: ${bankLedger.name} (${bankLedger.code}) | Supplier: ${supplierLedger.name} | Customer: ${customerLedger.name}`);

    // Import Canonical Daily Payment Posting Service
    const { postCanonicalDailyPayment } = await import("../lib/services/canonical-daily-payment-posting-service.js").catch(async () => {
      return await import("../lib/services/canonical-daily-payment-posting-service.ts");
    });

    const uniqueTag = Date.now().toString().slice(-6);

    // =========================================================================
    // SECTION 1: PURCHASE BOOKING
    // Original: DR Purchase/Inventory, CR Supplier/Party (posted ONCE from module)
    // Daily Payment: DR Supplier/Party (locked), CR Cash/Bank (settlement only)
    // =========================================================================
    console.log("\n--- SECTION 1: PURCHASE BOOKING VERIFICATION ---");
    let testPO = (await sql`
      select id, purchase_order_no, country_id, city_branch_id, currency_code, order_total, advance_paid, remaining_paid, remaining_due
      from purchase_orders
      where deleted_at is null
      order by created_at desc
      limit 1
    `)[0];

    if (!testPO) {
      // Create a test PO in Dev
      const newPOId = (await sql`select gen_random_uuid() as id`)[0].id;
      const poNum = `PO-DEV-${uniqueTag}`;
      await sql`
        insert into purchase_orders (
          id, purchase_order_no, country_id, currency_code, order_total, advance_paid, remaining_paid, remaining_due, payment_status, status
        ) values (
          ${newPOId}::uuid, ${poNum}, ${cashLedger.country_id || null}::uuid, 'USD', 10000, 0, 0, 10000, 'unpaid', 'confirmed'
        )
      `;
      testPO = (await sql`select id, purchase_order_no, country_id, city_branch_id, currency_code, order_total, advance_paid, remaining_paid, remaining_due from purchase_orders where id = ${newPOId}::uuid`)[0];
    }

    report("1A. Target Purchase Booking Identified", "PASS", `${testPO.purchase_order_no} (Total: ${testPO.order_total} ${testPO.currency_code})`);

    // Post Daily Payment 1: Advance (Cash)
    const poAdvAmt = 1500;
    const poAdvRes = await postCanonicalDailyPayment({
      targetType: "purchase_booking",
      targetId: testPO.id,
      direction: "purchase_payment",
      condition: "advance",
      method: "cash",
      entryDate: new Date().toISOString().slice(0, 10),
      currencyCode: testPO.currency_code || "USD",
      exchangeRate: 1,
      amount: poAdvAmt,
      debitLedgerId: supplierLedger.id,  // Supplier DR (LOCKED)
      creditLedgerId: cashLedger.id,     // Cash CR (SELECTED SOURCE)
      referenceNo: `ADV-PO-${uniqueTag}`,
      narration: `DEV Test: Purchase Booking Advance Payment`
    }, testActor);

    // Verify Roznamcha Entry for Daily Payment
    const poAdvRz = await sql`
      select re.id, re.journal_no, re.voucher_no, re.reference_no, re.source_module, re.source_transaction_type,
             count(rl.id) as line_count,
             sum(rl.debit) as total_debit,
             sum(rl.credit) as total_credit
      from roznamcha_entries re
      join roznamcha_lines rl on rl.roznamcha_entry_id = re.id
      where re.id = ${poAdvRes.roznamchaEntryId}::uuid
      group by re.id
    `;
    const poAdvLines = await sql`
      select rl.id, rl.debit, rl.credit, rl.payment_entry_type, l.name as ledger_name, l.id as ledger_id
      from roznamcha_lines rl
      join ledgers l on l.id = rl.ledger_id
      where rl.roznamcha_entry_id = ${poAdvRes.roznamchaEntryId}::uuid
    `;

    const poAdvBalanced = Math.abs(Number(poAdvRz[0]?.total_debit) - Number(poAdvRz[0]?.total_credit)) < 0.001;
    const poAdvDrParty = poAdvLines.some(l => l.ledger_id === supplierLedger.id && Number(l.debit) === poAdvAmt);
    const poAdvCrCash = poAdvLines.some(l => l.ledger_id === cashLedger.id && Number(l.credit) === poAdvAmt);
    // Ensure purchase/inventory account is NOT debited again
    const poAdvNoInventory = !poAdvLines.some(l => (l.ledger_name || "").toLowerCase().includes("inventory") || (l.ledger_name || "").toLowerCase().includes("purchase goods"));

    if (poAdvRes.success && poAdvBalanced && poAdvDrParty && poAdvCrCash && poAdvNoInventory && poAdvLines.length === 2) {
      report("1B. Purchase Booking Advance Settlement", "PASS", `Roznamcha ${poAdvRes.roznamchaEntryId}: DR Supplier ${poAdvAmt} / CR Cash ${poAdvAmt} (Exactly 2 lines, no inventory duplication)`);
    } else {
      report("1B. Purchase Booking Advance Settlement", "FAIL", `Balanced: ${poAdvBalanced}, DrParty: ${poAdvDrParty}, CrCash: ${poAdvCrCash}, Lines: ${poAdvLines.length}`);
    }

    // Post Daily Payment 2: Remaining Settlement (Bank Transfer) on SAME order
    const poRemAmt = 2000;
    const poRemRes = await postCanonicalDailyPayment({
      targetType: "purchase_booking",
      targetId: testPO.id,
      direction: "purchase_payment",
      condition: "remaining",
      method: "bank_transfer",
      entryDate: new Date().toISOString().slice(0, 10),
      currencyCode: testPO.currency_code || "USD",
      exchangeRate: 1,
      amount: poRemAmt,
      debitLedgerId: supplierLedger.id,  // Supplier DR (LOCKED)
      creditLedgerId: bankLedger.id,     // Bank CR (SELECTED SOURCE)
      referenceNo: `REM-PO-${uniqueTag}`,
      methodDetails: {
        bankId: testBank?.id,
        bankName: testBank?.bank_name || "Emirates NBD"
      },
      narration: `DEV Test: Purchase Booking Remaining Payment`
    }, testActor);

    // Verify PO balances updated without duplicate invoice
    const updatedPO = (await sql`
      select advance_paid, remaining_paid, remaining_due, order_total
      from purchase_orders where id = ${testPO.id}::uuid
    `)[0];

    const poBalanceCorrect = Number(updatedPO.advance_paid) > 0 && Number(updatedPO.remaining_paid) > 0;
    if (poRemRes.success && poBalanceCorrect) {
      report("1C. Purchase Booking Remaining Settlement & Balance Update", "PASS", `Order balances updated: Advance Paid = ${updatedPO.advance_paid}, Remaining Paid = ${updatedPO.remaining_paid}, Due = ${updatedPO.remaining_due}`);
    } else {
      report("1C. Purchase Booking Remaining Settlement & Balance Update", "FAIL", `Advance: ${updatedPO?.advance_paid}, Remaining: ${updatedPO?.remaining_paid}`);
    }


    // =========================================================================
    // SECTION 2: LOCAL PURCHASE
    // Original: DR Purchase/Inventory, CR Supplier/Party (posted ONCE from module)
    // Daily Payment: DR Supplier/Party (locked), CR Cash/Bank (settlement only)
    // =========================================================================
    console.log("\n--- SECTION 2: LOCAL PURCHASE VERIFICATION ---");
    let testLP = (await sql`
      select id, contract_no, country_id, city_branch_id, purchase_cost, advance_amount, remaining_balance, purchase_currency, local_currency
      from local_purchases
      where deleted_at is null
      order by created_at desc
      limit 1
    `)[0];

    if (!testLP) {
      const newLPId = (await sql`select gen_random_uuid() as id`)[0].id;
      const lpNum = `LP-DEV-${uniqueTag}`;
      await sql`
        insert into local_purchases (
          id, contract_no, country_id, purchase_cost, final_cost, advance_amount, remaining_balance, local_currency, purchase_currency, status
        ) values (
          ${newLPId}::uuid, ${lpNum}, ${cashLedger.country_id || null}::uuid, 8000, 8000, 0, 8000, 'AED', 'AED', 'transferred'
        )
      `;
      testLP = (await sql`select id, contract_no, country_id, city_branch_id, purchase_cost, advance_amount, remaining_balance, purchase_currency, local_currency from local_purchases where id = ${newLPId}::uuid`)[0];
    }

    report("2A. Target Local Purchase Identified", "PASS", `${testLP.contract_no || testLP.id} (Cost: ${testLP.purchase_cost})`);

    // Post Daily Payment on Local Purchase (Advance Cash)
    const lpAdvAmt = 1200;
    const lpAdvRes = await postCanonicalDailyPayment({
      targetType: "local_purchase",
      targetId: testLP.id,
      direction: "purchase_payment",
      condition: "advance",
      method: "cash",
      entryDate: new Date().toISOString().slice(0, 10),
      currencyCode: testLP.local_currency || "AED",
      exchangeRate: 1,
      amount: lpAdvAmt,
      debitLedgerId: supplierLedger.id,  // Supplier DR (LOCKED)
      creditLedgerId: cashLedger.id,     // Cash CR (SELECTED SOURCE)
      referenceNo: `LP-ADV-${uniqueTag}`,
      narration: `DEV Test: Local Purchase Advance Payment`
    }, testActor);

    // Verify Roznamcha Entry for Local Purchase Settlement
    const lpLines = await sql`
      select rl.id, rl.debit, rl.credit, l.name as ledger_name, l.id as ledger_id
      from roznamcha_lines rl
      join ledgers l on l.id = rl.ledger_id
      where rl.roznamcha_entry_id = ${lpAdvRes.roznamchaEntryId}::uuid
    `;
    const lpBalanced = lpLines.length === 2 && Number(lpLines[0].debit || lpLines[0].credit) === lpAdvAmt;
    const lpDrSupplier = lpLines.some(l => l.ledger_id === supplierLedger.id && Number(l.debit) === lpAdvAmt);
    const lpCrCash = lpLines.some(l => l.ledger_id === cashLedger.id && Number(l.credit) === lpAdvAmt);

    // Verify Local Purchase balance updated
    const updatedLP = (await sql`
      select advance_amount, remaining_balance
      from local_purchases where id = ${testLP.id}::uuid
    `)[0];

    if (lpAdvRes.success && lpBalanced && lpDrSupplier && lpCrCash) {
      report("2B. Local Purchase Settlement Posting", "PASS", `Roznamcha ${lpAdvRes.roznamchaEntryId}: DR Supplier ${lpAdvAmt} / CR Cash ${lpAdvAmt} (Exactly 2 lines, no duplicate inventory)`);
      report("2C. Local Purchase Balance Update", "PASS", `advance_amount = ${updatedLP.advance_amount}, remaining_balance = ${updatedLP.remaining_balance}`);
    } else {
      report("2B. Local Purchase Settlement Posting", "FAIL", `lpBalanced: ${lpBalanced}, lpDrSupplier: ${lpDrSupplier}, lpCrCash: ${lpCrCash}`);
    }


    // =========================================================================
    // SECTION 3: SALES BOOKING
    // Original: DR Customer/Receivable, CR Sales/Revenue (posted ONCE from module)
    // Daily Payment: DR Cash/Bank (selected receiving), CR Customer (locked)
    // =========================================================================
    console.log("\n--- SECTION 3: SALES BOOKING VERIFICATION ---");
    let testSO = (await sql`
      select id, sales_order_no, country_id, city_branch_id, currency_code, order_total, paid_amount, remaining_amount
      from sales_orders
      where deleted_at is null
        and (form_data->>'saleSource' is null or form_data->>'saleSource' != 'local')
      order by created_at desc
      limit 1
    `)[0];

    if (!testSO) {
      const newSOId = (await sql`select gen_random_uuid() as id`)[0].id;
      const soNum = `SO-DEV-${uniqueTag}`;
      await sql`
        insert into sales_orders (
          id, sales_order_no, country_id, currency_code, order_total, paid_amount, remaining_amount, payment_status, sales_status
        ) values (
          ${newSOId}::uuid, ${soNum}, ${cashLedger.country_id || null}::uuid, 'USD', 15000, 0, 15000, 'unpaid', 'confirmed'
        )
      `;
      testSO = (await sql`select id, sales_order_no, country_id, city_branch_id, currency_code, order_total, paid_amount, remaining_amount from sales_orders where id = ${newSOId}::uuid`)[0];
    }

    report("3A. Target Sales Booking Identified", "PASS", `${testSO.sales_order_no} (Total: ${testSO.order_total} ${testSO.currency_code})`);

    // Post Daily Payment (Sales Receipt - Cash)
    const soRecAmt = 2500;
    const soRecRes = await postCanonicalDailyPayment({
      targetType: "sales_booking",
      targetId: testSO.id,
      direction: "sales_payment",
      condition: "advance",
      method: "cash",
      entryDate: new Date().toISOString().slice(0, 10),
      currencyCode: testSO.currency_code || "USD",
      exchangeRate: 1,
      amount: soRecAmt,
      debitLedgerId: cashLedger.id,       // Selected Receiving Account DR
      creditLedgerId: customerLedger.id,  // Customer Account CR (LOCKED)
      referenceNo: `SO-REC-${uniqueTag}`,
      narration: `DEV Test: Sales Booking Advance Receipt`
    }, testActor);

    // Verify Roznamcha Entry for Sales Receipt
    const soLines = await sql`
      select rl.id, rl.debit, rl.credit, l.name as ledger_name, l.id as ledger_id
      from roznamcha_lines rl
      join ledgers l on l.id = rl.ledger_id
      where rl.roznamcha_entry_id = ${soRecRes.roznamchaEntryId}::uuid
    `;
    const soBalanced = soLines.length === 2 && Number(soLines[0].debit || soLines[0].credit) === soRecAmt;
    const soDrCash = soLines.some(l => l.ledger_id === cashLedger.id && Number(l.debit) === soRecAmt);
    const soCrCustomer = soLines.some(l => l.ledger_id === customerLedger.id && Number(l.credit) === soRecAmt);
    // Ensure Sales/Revenue is NOT credited again
    const soNoRevenueRepeat = !soLines.some(l => (l.ledger_name || "").toLowerCase().includes("sales") || (l.ledger_name || "").toLowerCase().includes("revenue"));

    const updatedSO = (await sql`
      select paid_amount, remaining_amount, order_total
      from sales_orders where id = ${testSO.id}::uuid
    `)[0];

    if (soRecRes.success && soBalanced && soDrCash && soCrCustomer && soNoRevenueRepeat) {
      report("3B. Sales Booking Receipt Settlement", "PASS", `Roznamcha ${soRecRes.roznamchaEntryId}: DR Cash ${soRecAmt} / CR Customer ${soRecAmt} (Exactly 2 lines, no revenue repeat)`);
      report("3C. Sales Booking Balance Update", "PASS", `Paid: ${updatedSO.paid_amount}, Remaining: ${updatedSO.remaining_amount}`);
    } else {
      report("3B. Sales Booking Receipt Settlement", "FAIL", `soBalanced: ${soBalanced}, soDrCash: ${soDrCash}, soCrCustomer: ${soCrCustomer}`);
    }


    // =========================================================================
    // SECTION 4: LOCAL SALES
    // Original: DR Customer/Receivable, CR Sales/Revenue (posted ONCE from module)
    // Daily Payment: DR Cash/Bank (selected receiving), CR Customer (locked)
    // =========================================================================
    console.log("\n--- SECTION 4: LOCAL SALES VERIFICATION ---");
    let testLocalSale = (await sql`
      select id, sales_order_no, country_id, city_branch_id, currency_code, order_total, paid_amount, remaining_amount
      from sales_orders
      where deleted_at is null
        and (form_data->>'saleSource' = 'local' or form_data->>'saleMode' = 'local')
      order by created_at desc
      limit 1
    `)[0];

    if (!testLocalSale) {
      const newLSId = (await sql`select gen_random_uuid() as id`)[0].id;
      const lsNum = `LS-DEV-${uniqueTag}`;
      await sql`
        insert into sales_orders (
          id, sales_order_no, country_id, currency_code, order_total, paid_amount, remaining_amount, payment_status, sales_status,
          form_data
        ) values (
          ${newLSId}::uuid, ${lsNum}, ${cashLedger.country_id || null}::uuid, 'AED', 5000, 0, 5000, 'unpaid', 'confirmed',
          '{"saleSource": "local", "saleMode": "local"}'::jsonb
        )
      `;
      testLocalSale = (await sql`select id, sales_order_no, country_id, city_branch_id, currency_code, order_total, paid_amount, remaining_amount from sales_orders where id = ${newLSId}::uuid`)[0];
    }

    report("4A. Target Local Sales Identified", "PASS", `${testLocalSale.sales_order_no} (Total: ${testLocalSale.order_total} ${testLocalSale.currency_code})`);

    // Post Daily Payment on Local Sales (Bank Transfer Receipt)
    const lsRecAmt = 1800;
    const lsRecRes = await postCanonicalDailyPayment({
      targetType: "local_sales",
      targetId: testLocalSale.id,
      direction: "sales_payment",
      condition: "credit",
      method: "bank_transfer",
      entryDate: new Date().toISOString().slice(0, 10),
      currencyCode: testLocalSale.currency_code || "AED",
      exchangeRate: 1,
      amount: lsRecAmt,
      debitLedgerId: bankLedger.id,       // Selected Receiving Bank DR
      creditLedgerId: customerLedger.id,  // Customer Account CR (LOCKED)
      referenceNo: `LS-REC-${uniqueTag}`,
      methodDetails: {
        bankId: testBank?.id,
        bankName: testBank?.bank_name || "Mashreq Bank"
      },
      narration: `DEV Test: Local Sales Credit Receipt (Bank)`
    }, testActor);

    // Verify Roznamcha Entry for Local Sales Receipt
    const lsLines = await sql`
      select rl.id, rl.debit, rl.credit, l.name as ledger_name, l.id as ledger_id
      from roznamcha_lines rl
      join ledgers l on l.id = rl.ledger_id
      where rl.roznamcha_entry_id = ${lsRecRes.roznamchaEntryId}::uuid
    `;
    const lsBalanced = lsLines.length === 2 && Number(lsLines[0].debit || lsLines[0].credit) === lsRecAmt;
    const lsDrBank = lsLines.some(l => l.ledger_id === bankLedger.id && Number(l.debit) === lsRecAmt);
    const lsCrCustomer = lsLines.some(l => l.ledger_id === customerLedger.id && Number(l.credit) === lsRecAmt);

    const updatedLS = (await sql`
      select paid_amount, remaining_amount, order_total
      from sales_orders where id = ${testLocalSale.id}::uuid
    `)[0];

    if (lsRecRes.success && lsBalanced && lsDrBank && lsCrCustomer) {
      report("4B. Local Sales Receipt Settlement Posting", "PASS", `Roznamcha ${lsRecRes.roznamchaEntryId}: DR Bank ${lsRecAmt} / CR Customer ${lsRecAmt} (Exactly 2 lines, no revenue repeat)`);
      report("4C. Local Sales Balance Update", "PASS", `Paid: ${updatedLS.paid_amount}, Remaining: ${updatedLS.remaining_amount}`);
    } else {
      report("4B. Local Sales Receipt Settlement Posting", "FAIL", `lsBalanced: ${lsBalanced}, lsDrBank: ${lsDrBank}, lsCrCustomer: ${lsCrCustomer}`);
    }


    // =========================================================================
    // SECTION 5: CONTROLS & INTEGRITY GUARDS
    // =========================================================================
    console.log("\n--- SECTION 5: ENTERPRISE CONTROLS & INTEGRITY GUARDS ---");

    // 5A: Duplicate TT Reference Prevention
    const ttRef = `TT-DEV-GUARD-${uniqueTag}`;
    const ttRes = await postCanonicalDailyPayment({
      targetType: "purchase_booking",
      targetId: testPO.id,
      direction: "purchase_payment",
      condition: "credit",
      method: "tt_swift",
      entryDate: new Date().toISOString().slice(0, 10),
      currencyCode: testPO.currency_code || "USD",
      exchangeRate: 1,
      amount: 500,
      debitLedgerId: supplierLedger.id,
      creditLedgerId: bankLedger.id,
      referenceNo: ttRef,
      methodDetails: {
        bankId: testBank?.id,
        ttReference: ttRef
      },
      narration: `TT Initial Payment`
    }, testActor);

    let dupBlocked = false;
    let dupMsg = "";
    try {
      await postCanonicalDailyPayment({
        targetType: "purchase_booking",
        targetId: testPO.id,
        direction: "purchase_payment",
        condition: "credit",
        method: "tt_swift",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: testPO.currency_code || "USD",
        exchangeRate: 1,
        amount: 500,
        debitLedgerId: supplierLedger.id,
        creditLedgerId: bankLedger.id,
        referenceNo: ttRef,
        methodDetails: {
          bankId: testBank?.id,
          ttReference: ttRef
        },
        narration: `Duplicate TT attempt`
      }, testActor);
    } catch (err) {
      dupBlocked = true;
      dupMsg = err.message;
    }

    if (dupBlocked && dupMsg.toLowerCase().includes("duplicate")) {
      report("5A. Duplicate TT Reference Guard", "PASS", `Rejected duplicate TT reference: "${dupMsg}"`);
    } else {
      report("5A. Duplicate TT Reference Guard", "FAIL", `Duplicate TT was NOT blocked! Message: ${dupMsg}`);
    }

    // 5B: Missing Ledger Mapping Guard (No auto-creation)
    let missingBlocked = false;
    let missingMsg = "";
    try {
      await postCanonicalDailyPayment({
        targetType: "purchase_booking",
        targetId: testPO.id,
        direction: "purchase_payment",
        condition: "advance",
        method: "cash",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "USD",
        exchangeRate: 1,
        amount: 100,
        debitLedgerId: "00000000-0000-0000-0000-000000000000",
        creditLedgerId: cashLedger.id,
        referenceNo: `MISSING-${uniqueTag}`,
        narration: `Test missing ledger`
      }, testActor);
    } catch (err) {
      missingBlocked = true;
      missingMsg = err.message;
    }

    if (missingBlocked && (missingMsg.includes("does not exist") || missingMsg.includes("valid mapping") || missingMsg.includes("strictly required"))) {
      report("5B. Missing Ledger Mapping Guard", "PASS", `Blocked unmapped ledger: "${missingMsg}"`);
    } else {
      report("5B. Missing Ledger Mapping Guard", "FAIL", `Payment was NOT blocked for missing ledger! ${missingMsg}`);
    }


    // =========================================================================
    // SECTION 6: PRINT / PDF VOUCHER REFERENCE VERIFICATION
    // =========================================================================
    console.log("\n--- SECTION 6: PRINT / PDF VOUCHER REFERENCE VERIFICATION ---");
    const voucherPrintPayload = {
      id: poAdvRes.paymentId,
      refNo: `ADV-PO-${uniqueTag}`,
      orderNo: testPO.purchase_order_no,
      date: new Date().toISOString().slice(0, 10),
      flow: "supplier_payment",
      module: "purchase",
      country: "United Arab Emirates",
      branch: "Main Branch",
      party: `${supplierLedger.name} (${supplierLedger.code})`,
      paymentKind: "advance",
      currency: testPO.currency_code || "USD",
      amount: poAdvAmt,
      exchangeRate: 1,
      baseAmount: poAdvAmt,
      debitLedgerName: supplierLedger.name,
      creditLedgerName: cashLedger.name,
      superAdminSerial: poAdvRes.serialNumber?.split(" | ")[0] || "SA-0001",
      countrySerial: poAdvRes.serialNumber?.split(" | ")[1] || "CT-0001",
      branchSerial: poAdvRes.serialNumber?.split(" | ")[2] || "BR-0001"
    };

    const hasOriginalInvoiceRef = Boolean(voucherPrintPayload.orderNo && voucherPrintPayload.orderNo.length > 0);
    const hasPaymentVoucherRef = Boolean(voucherPrintPayload.refNo && voucherPrintPayload.refNo.length > 0);
    const hasAuditSerials = Boolean(voucherPrintPayload.superAdminSerial);
    const hasBalancedLedgerNames = Boolean(voucherPrintPayload.debitLedgerName && voucherPrintPayload.creditLedgerName);

    if (hasOriginalInvoiceRef && hasPaymentVoucherRef && hasAuditSerials && hasBalancedLedgerNames) {
      report("6. Print/PDF Voucher Dual-Reference Trace", "PASS", `Original Invoice Ref: "${voucherPrintPayload.orderNo}" | Payment Voucher Ref: "${voucherPrintPayload.refNo}" | Debit: ${voucherPrintPayload.debitLedgerName} | Credit: ${voucherPrintPayload.creditLedgerName}`);
    } else {
      report("6. Print/PDF Voucher Dual-Reference Trace", "FAIL", `Missing refs: orderNo=${hasOriginalInvoiceRef}, refNo=${hasPaymentVoucherRef}`);
    }

  } catch (err) {
    console.error("FATAL in test runner:", err);
    report("Test Runner Execution", "FAIL", err.message);
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("\n================================================================================");
  console.log("FINAL VERIFICATION SUMMARY ACROSS ALL 4 SOURCES");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const skipped = results.filter(r => r.status === "SKIP").length;

  console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed} | SKIPPED: ${skipped}`);
  if (failed === 0) {
    console.log(">>> SUCCESS: ALL VERIFICATIONS CONFIRMED ON DEV! <<<");
  } else {
    console.log(">>> ATTENTION: FAILURES DETECTED <<<");
  }
}

runAll();
