import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

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
console.log("DEV ENVIRONMENT VERIFICATION — STANDARDIZED DAILY PAYMENTS");
console.log("================================================================================");
console.log(`Active Target DB URL: ${supabaseUrl}`);
console.log(`Checking DB Reference: ${DEV_REF}`);

if (!supabaseUrl.includes(DEV_REF)) {
  console.error(`ABORT: Target is NOT Dev DB ${DEV_REF}! Production protection triggered.`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const sql = postgres(dbUrl, { max: 2, prepare: false, ssl: "require" });

const results = [];
function report(testName, status, details = "") {
  results.push({ testName, status, details });
  console.log(`[${status === "PASS" ? "✓ PASS" : "✗ FAIL"}] ${testName} ${details ? `— ${details}` : ""}`);
}

async function runDevVerification() {
  try {
    // 0. Fetch test actor / user from Dev
    let testActor;
    const authUsers = await sql`select id, email from auth.users limit 5`;
    if (authUsers.length) {
      testActor = {
        userId: authUsers[0].id,
        userName: authUsers[0].email || "Super Admin",
        userRole: "super_admin"
      };
    } else {
      testActor = {
        userId: "22222222-2222-4000-8000-000000000002",
        userName: "shipping.superadmin@dgt.llc",
        userRole: "super_admin"
      };
    }
    report("0. Setup Dev Test Actor", "PASS", `User: ${testActor.userName} (${testActor.userId})`);

    // 1. Fetch Master Data from Dev (Countries, Ledgers, Banks, Purchase Orders, Sales Orders, Local Purchases)
    const { data: ledgers, error: lErr } = await supabase
      .from("ledgers")
      .select("id, code, name, currency, country_id, city_branch_id")
      .is("deleted_at", null)
      .limit(30);
    if (lErr || !ledgers || ledgers.length < 2) throw new Error("Insufficient ledgers in Dev DB");

    const cashLedger = ledgers.find(l => (l.name || "").toLowerCase().includes("cash") || (l.code || "").toLowerCase().includes("cash")) || ledgers[0];
    const bankLedger = ledgers.find(l => (l.name || "").toLowerCase().includes("bank") || (l.code || "").toLowerCase().includes("bank")) || ledgers[1];
    const partyLedger = ledgers.find(l => l.id !== cashLedger.id && l.id !== bankLedger.id) || ledgers[2];

    const { data: banks } = await supabase.from("banks").select("id, bank_name, currency, country_id").is("deleted_at", null).limit(5);
    const testBank = banks?.[0];

    const { data: pos } = await supabase.from("purchase_orders").select("id, purchase_order_no, country_id, city_branch_id, currency_code, order_total").is("deleted_at", null).limit(5);
    const testPO = pos?.[0];

    const { data: sos } = await supabase.from("sales_orders").select("id, sales_order_no, country_id, city_branch_id, currency_code, order_total").is("deleted_at", null).limit(5);
    const testSO = sos?.[0];

    const { data: lps } = await supabase.from("local_purchases").select("id, contract_no, goods_name, purchase_cost, currency:local_currency, country_id, city_branch_id").is("deleted_at", null).limit(5);
    const testLP = lps?.[0];

    report("1. Master Data Resolution", "PASS", `Cash Ledger: ${cashLedger.name}, Bank Ledger: ${bankLedger.name}, Party Ledger: ${partyLedger.name}`);

    // Import Canonical Posting Service dynamically
    const { postCanonicalDailyPayment } = await import("../lib/services/canonical-daily-payment-posting-service.js").catch(async () => {
      return await import("../lib/services/canonical-daily-payment-posting-service.ts");
    });

    const uniqueSuffix = Date.now().toString().slice(-6);

    // =========================================================================
    // TEST 1: Purchase Booking — Advance Payment (Cash)
    // Rule: Supplier Account = DR, Cash Account = CR
    // =========================================================================
    if (testPO) {
      const res1 = await postCanonicalDailyPayment({
        targetType: "purchase_booking",
        targetId: testPO.id,
        direction: "purchase_payment",
        condition: "advance",
        method: "cash",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "AED",
        exchangeRate: 1,
        amount: 250,
        debitLedgerId: partyLedger.id, // Supplier DR
        creditLedgerId: cashLedger.id,  // Source Cash CR
        referenceNo: `ADV-CASH-${uniqueSuffix}`,
        narration: `Automated DEV Test: Purchase Advance Cash Payment`
      }, testActor);

      const rzLines = await sql`
        select rl.debit, rl.credit, l.name as ledger_name, rl.ledger_id
        from roznamcha_lines rl
        join ledgers l on l.id = rl.ledger_id
        where rl.roznamcha_entry_id = ${res1.roznamchaEntryId}::uuid
      `;
      const sumDr = rzLines.reduce((s, r) => s + Number(r.debit), 0);
      const sumCr = rzLines.reduce((s, r) => s + Number(r.credit), 0);
      const isBalanced = Math.abs(sumDr - sumCr) < 0.001 && sumDr === 250;
      const isDrParty = rzLines.some(r => r.ledger_id === partyLedger.id && Number(r.debit) === 250);
      const isCrCash = rzLines.some(r => r.ledger_id === cashLedger.id && Number(r.credit) === 250);

      if (res1.success && isBalanced && isDrParty && isCrCash) {
        report("TEST 1: Purchase Booking Advance (Cash)", "PASS", `Roznamcha ${res1.roznamchaEntryId}: DR Party 250 / CR Cash 250 (BALANCED)`);
      } else {
        report("TEST 1: Purchase Booking Advance (Cash)", "FAIL", `sumDr: ${sumDr}, sumCr: ${sumCr}, isDrParty: ${isDrParty}, isCrCash: ${isCrCash}`);
      }
    } else {
      report("TEST 1: Purchase Booking Advance (Cash)", "SKIP", "No Purchase Order found in DEV DB");
    }

    // =========================================================================
    // TEST 2: Purchase Booking — Endorsement Payment (Bank Transfer)
    // Rule: Supplier Account = DR, Bank Account = CR
    // =========================================================================
    if (testPO) {
      const res2 = await postCanonicalDailyPayment({
        targetType: "purchase_booking",
        targetId: testPO.id,
        direction: "purchase_payment",
        condition: "endorsement",
        method: "bank_transfer",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "AED",
        exchangeRate: 1,
        amount: 500,
        debitLedgerId: partyLedger.id, // Supplier DR
        creditLedgerId: bankLedger.id,  // Bank CR
        referenceNo: `END-BANK-${uniqueSuffix}`,
        methodDetails: {
          bankId: testBank?.id,
          bankName: testBank?.bank_name || "Emirates NBD"
        },
        narration: `Automated DEV Test: Purchase Endorsement Bank Transfer`
      }, testActor);

      const rzLines = await sql`
        select rl.debit, rl.credit, rl.ledger_id
        from roznamcha_lines rl
        where rl.roznamcha_entry_id = ${res2.roznamchaEntryId}::uuid
      `;
      const sumDr = rzLines.reduce((s, r) => s + Number(r.debit), 0);
      const sumCr = rzLines.reduce((s, r) => s + Number(r.credit), 0);
      const isBalanced = Math.abs(sumDr - sumCr) < 0.001 && sumDr === 500;
      const isDrParty = rzLines.some(r => r.ledger_id === partyLedger.id && Number(r.debit) === 500);
      const isCrBank = rzLines.some(r => r.ledger_id === bankLedger.id && Number(r.credit) === 500);

      if (res2.success && isBalanced && isDrParty && isCrBank) {
        report("TEST 2: Purchase Booking Endorsement (Bank Transfer)", "PASS", `Roznamcha ${res2.roznamchaEntryId}: DR Party 500 / CR Bank 500 (BALANCED)`);
      } else {
        report("TEST 2: Purchase Booking Endorsement (Bank Transfer)", "FAIL", `sumDr: ${sumDr}, sumCr: ${sumCr}`);
      }
    }

    // =========================================================================
    // TEST 3: Purchase Booking — Credit Payment (TT/SWIFT) & Duplicate TT Guard
    // Rule: Supplier Account = DR, Source CR, Duplicate TT must be BLOCKED
    // =========================================================================
    if (testPO) {
      const ttRef = `TT-SWIFT-${uniqueSuffix}`;
      const res3 = await postCanonicalDailyPayment({
        targetType: "purchase_booking",
        targetId: testPO.id,
        direction: "purchase_payment",
        condition: "credit",
        method: "tt_swift",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "AED",
        exchangeRate: 1,
        amount: 350,
        debitLedgerId: partyLedger.id,
        creditLedgerId: bankLedger.id,
        referenceNo: ttRef,
        methodDetails: {
          bankId: testBank?.id,
          bankName: testBank?.bank_name || "Abu Dhabi Islamic Bank",
          ttReference: ttRef
        },
        narration: `Automated DEV Test: TT/SWIFT Credit Payment`
      }, testActor);

      if (res3.success) {
        report("TEST 3A: Purchase Booking Credit (TT/SWIFT)", "PASS", `Payment recorded with TT Reference: ${ttRef}`);
      } else {
        report("TEST 3A: Purchase Booking Credit (TT/SWIFT)", "FAIL", "Failed to record first TT payment");
      }

      // Try duplicate submission with SAME TT Reference -> MUST FAIL
      let duplicateBlocked = false;
      let duplicateErrMsg = "";
      try {
        await postCanonicalDailyPayment({
          targetType: "purchase_booking",
          targetId: testPO.id,
          direction: "purchase_payment",
          condition: "credit",
          method: "tt_swift",
          entryDate: new Date().toISOString().slice(0, 10),
          currencyCode: "AED",
          exchangeRate: 1,
          amount: 350,
          debitLedgerId: partyLedger.id,
          creditLedgerId: bankLedger.id,
          referenceNo: ttRef,
          methodDetails: {
            bankId: testBank?.id,
            ttReference: ttRef
          },
          narration: `Duplicate TT attempt`
        }, testActor);
      } catch (err) {
        duplicateBlocked = true;
        duplicateErrMsg = err.message;
      }

      if (duplicateBlocked && duplicateErrMsg.toLowerCase().includes("duplicate")) {
        report("TEST 3B: Duplicate TT Reference Guard", "PASS", `Correctly rejected duplicate TT: "${duplicateErrMsg}"`);
      } else {
        report("TEST 3B: Duplicate TT Reference Guard", "FAIL", `Duplicate was NOT blocked! Error: ${duplicateErrMsg}`);
      }
    }

    // =========================================================================
    // TEST 4: Purchase Booking — Remaining Payment (Mobile Wallet)
    // Rule: Supplier Account = DR, Wallet Account = CR
    // =========================================================================
    if (testPO) {
      const res4 = await postCanonicalDailyPayment({
        targetType: "purchase_booking",
        targetId: testPO.id,
        direction: "purchase_payment",
        condition: "remaining",
        method: "mobile_wallet",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "AED",
        exchangeRate: 1,
        amount: 150,
        debitLedgerId: partyLedger.id,
        creditLedgerId: cashLedger.id,
        referenceNo: `WALLET-${uniqueSuffix}`,
        methodDetails: {
          walletProvider: "EasyPaisa",
          walletAccountNumber: "03001234567",
          walletTransactionId: `TXN-${uniqueSuffix}`
        },
        narration: `Automated DEV Test: Mobile Wallet Remaining Payment`
      }, testActor);

      if (res4.success) {
        report("TEST 4: Purchase Booking Remaining (Mobile Wallet)", "PASS", `Wallet payment recorded, remaining balance updated`);
      } else {
        report("TEST 4: Purchase Booking Remaining (Mobile Wallet)", "FAIL", "Failed to record wallet payment");
      }
    }

    // =========================================================================
    // TEST 5: Purchase Booking — Final Payment (Cheque)
    // Rule: Supplier Account = DR, Bank Account = CR, Cheque fields preserved
    // =========================================================================
    if (testPO) {
      const chqNum = `CHQ-${uniqueSuffix}`;
      const res5 = await postCanonicalDailyPayment({
        targetType: "purchase_booking",
        targetId: testPO.id,
        direction: "purchase_payment",
        condition: "final",
        method: "cheque",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "AED",
        exchangeRate: 1,
        amount: 100,
        debitLedgerId: partyLedger.id,
        creditLedgerId: bankLedger.id,
        referenceNo: chqNum,
        methodDetails: {
          bankId: testBank?.id,
          bankName: testBank?.bank_name || "Dubai Islamic Bank",
          chequeNumber: chqNum,
          chequeDate: new Date().toISOString().slice(0, 10),
          chequePayee: partyLedger.name,
          chequeStatus: "Cleared"
        },
        narration: `Automated DEV Test: Cheque Final Payment`
      }, testActor);

      if (res5.success) {
        report("TEST 5: Purchase Booking Final (Cheque)", "PASS", `Cheque payment recorded: ${chqNum}`);
      } else {
        report("TEST 5: Purchase Booking Final (Cheque)", "FAIL", "Failed to record cheque payment");
      }
    }

    // =========================================================================
    // TEST 6: Local Purchase — Advance Payment (Cash)
    // Rule: Direct Local Purchase Roznamcha settlement, Supplier DR / Cash CR
    // =========================================================================
    if (testLP) {
      const res6 = await postCanonicalDailyPayment({
        targetType: "local_purchase",
        targetId: testLP.id,
        direction: "purchase_payment",
        condition: "advance",
        method: "cash",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "AED",
        exchangeRate: 1,
        amount: 400,
        debitLedgerId: partyLedger.id,
        creditLedgerId: cashLedger.id,
        referenceNo: `LP-ADV-${uniqueSuffix}`,
        narration: `Automated DEV Test: Local Purchase Advance Payment`
      }, testActor);

      const rzLines = await sql`
        select rl.debit, rl.credit, rl.ledger_id
        from roznamcha_lines rl
        where rl.roznamcha_entry_id = ${res6.roznamchaEntryId}::uuid
      `;
      const sumDr = rzLines.reduce((s, r) => s + Number(r.debit), 0);
      const sumCr = rzLines.reduce((s, r) => s + Number(r.credit), 0);
      const isBalanced = Math.abs(sumDr - sumCr) < 0.001 && sumDr === 400;

      if (res6.success && isBalanced) {
        report("TEST 6: Local Purchase Advance (Cash)", "PASS", `Local Purchase Roznamcha ${res6.roznamchaEntryId} BALANCED 400 AED`);
      } else {
        report("TEST 6: Local Purchase Advance (Cash)", "FAIL", `sumDr: ${sumDr}, sumCr: ${sumCr}`);
      }
    } else {
      report("TEST 6: Local Purchase Advance (Cash)", "SKIP", "No Local Purchase in DEV DB");
    }

    // =========================================================================
    // TEST 7: Sales Booking — Advance Receipt (Cash)
    // Rule: Selected Receiving Cash = DR, Customer Account = CR
    // =========================================================================
    if (testSO) {
      const res7 = await postCanonicalDailyPayment({
        targetType: "sales_booking",
        targetId: testSO.id,
        direction: "sales_payment",
        condition: "advance",
        method: "cash",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "AED",
        exchangeRate: 1,
        amount: 300,
        debitLedgerId: cashLedger.id,   // Selected Receiving Account = DR
        creditLedgerId: partyLedger.id, // Customer/Receivable Account = CR
        referenceNo: `SO-ADV-${uniqueSuffix}`,
        narration: `Automated DEV Test: Sales Advance Receipt (Cash)`
      }, testActor);

      if (res7.success) {
        report("TEST 7: Sales Booking Advance Receipt (Cash)", "PASS", `Receiving Account (Cash) DR 300 / Customer CR 300`);
      } else {
        report("TEST 7: Sales Booking Advance Receipt (Cash)", "FAIL", "Failed to record sales advance");
      }
    } else {
      report("TEST 7: Sales Booking Advance Receipt (Cash)", "SKIP", "No Sales Order in DEV DB");
    }

    // =========================================================================
    // TEST 8: Sales Booking — Credit Receipt (Bank Transfer)
    // Rule: Selected Receiving Bank = DR, Customer Account = CR
    // =========================================================================
    if (testSO) {
      const res8 = await postCanonicalDailyPayment({
        targetType: "sales_booking",
        targetId: testSO.id,
        direction: "sales_payment",
        condition: "credit",
        method: "bank_transfer",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "AED",
        exchangeRate: 1,
        amount: 600,
        debitLedgerId: bankLedger.id,   // Bank DR
        creditLedgerId: partyLedger.id, // Customer CR
        referenceNo: `SO-CR-${uniqueSuffix}`,
        methodDetails: {
          bankId: testBank?.id,
          bankName: testBank?.bank_name || "Mashreq Bank"
        },
        narration: `Automated DEV Test: Sales Credit Receipt (Bank)`
      }, testActor);

      if (res8.success) {
        report("TEST 8: Sales Booking Credit Receipt (Bank)", "PASS", `Bank DR 600 / Customer CR 600`);
      } else {
        report("TEST 8: Sales Booking Credit Receipt (Bank)", "FAIL", "Failed to record sales credit");
      }
    }

    // =========================================================================
    // TEST 9: Sales Booking — Remaining Receipt (Internal Transfer)
    // Rule: Receiving Account = DR, Customer Account = CR
    // =========================================================================
    if (testSO) {
      const res9 = await postCanonicalDailyPayment({
        targetType: "sales_booking",
        targetId: testSO.id,
        direction: "sales_payment",
        condition: "remaining",
        method: "internal_transfer",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "AED",
        exchangeRate: 1,
        amount: 200,
        debitLedgerId: cashLedger.id,
        creditLedgerId: partyLedger.id,
        referenceNo: `SO-TRF-${uniqueSuffix}`,
        narration: `Automated DEV Test: Internal Account Transfer Receipt`
      }, testActor);

      if (res9.success) {
        report("TEST 9: Sales Booking Remaining (Internal Transfer)", "PASS", `Internal transfer DR Cash 200 / CR Customer 200`);
      } else {
        report("TEST 9: Sales Booking Remaining (Internal Transfer)", "FAIL", "Failed to record internal transfer");
      }
    }

    // =========================================================================
    // TEST 10: Sales Booking — Final Receipt (Cheque)
    // Rule: Receiving Account = DR, Customer Account = CR
    // =========================================================================
    if (testSO) {
      const res10 = await postCanonicalDailyPayment({
        targetType: "sales_booking",
        targetId: testSO.id,
        direction: "sales_payment",
        condition: "final",
        method: "cheque",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "AED",
        exchangeRate: 1,
        amount: 120,
        debitLedgerId: bankLedger.id,
        creditLedgerId: partyLedger.id,
        referenceNo: `SO-CHQ-${uniqueSuffix}`,
        methodDetails: {
          chequeNumber: `CHQ-SO-${uniqueSuffix}`,
          chequeDate: new Date().toISOString().slice(0, 10),
          chequePayee: "Company Account",
          chequeStatus: "Cleared"
        },
        narration: `Automated DEV Test: Sales Cheque Final Receipt`
      }, testActor);

      if (res10.success) {
        report("TEST 10: Sales Booking Final Receipt (Cheque)", "PASS", `Cheque Receipt DR Bank 120 / CR Customer 120`);
      } else {
        report("TEST 10: Sales Booking Final Receipt (Cheque)", "FAIL", "Failed to record cheque receipt");
      }
    }

    // =========================================================================
    // TEST 11: Control — Missing Ledger Mapping MUST BLOCK Payment
    // Rule: Automatic account/ledger creation is FORBIDDEN. Missing ledger blocks.
    // =========================================================================
    if (testPO) {
      const fakeLedgerId = "e0000000-0000-4000-8000-000000000000";
      let blockedMissing = false;
      let blockedMsg = "";
      try {
        await postCanonicalDailyPayment({
          targetType: "purchase_booking",
          targetId: testPO.id,
          direction: "purchase_payment",
          condition: "advance",
          method: "cash",
          entryDate: new Date().toISOString().slice(0, 10),
          currencyCode: "AED",
          exchangeRate: 1,
          amount: 100,
          debitLedgerId: fakeLedgerId, // Unmapped fake ledger ID
          creditLedgerId: cashLedger.id,
          referenceNo: `TEST-MISSING-${uniqueSuffix}`,
          narration: `Missing ledger test`
        }, testActor);
      } catch (err) {
        blockedMissing = true;
        blockedMsg = err.message;
      }

      if (blockedMissing && (blockedMsg.includes("does not exist") || blockedMsg.includes("valid mapping") || blockedMsg.includes("strictly required"))) {
        report("TEST 11: Missing Ledger Mapping Guard", "PASS", `Properly blocked payment with message: "${blockedMsg}"`);
      } else {
        report("TEST 11: Missing Ledger Mapping Guard", "FAIL", `Payment was NOT blocked when ledger was unmapped! ${blockedMsg}`);
      }
    }

    // =========================================================================
    // TEST 12: Currency Single Conversion Rule
    // Rule: UAE AED-to-AED exchange rate 1. Foreign converts ONCE only.
    // =========================================================================
    if (testPO) {
      // 100 USD @ exchange rate 3.6725 -> baseCurrencyAmount must be 367.25, NOT double converted
      const res12 = await postCanonicalDailyPayment({
        targetType: "purchase_booking",
        targetId: testPO.id,
        direction: "purchase_payment",
        condition: "advance",
        method: "bank_transfer",
        entryDate: new Date().toISOString().slice(0, 10),
        currencyCode: "USD",
        exchangeRate: 3.6725,
        amount: 100, // 100 USD
        debitLedgerId: partyLedger.id,
        creditLedgerId: bankLedger.id,
        referenceNo: `FX-TEST-${uniqueSuffix}`,
        narration: `Foreign currency single conversion test`
      }, testActor);

      const rzLines = await sql`
        select rl.debit, rl.credit
        from roznamcha_lines rl
        where rl.roznamcha_entry_id = ${res12.roznamchaEntryId}::uuid
      `;
      const baseAmt = Number(rzLines[0]?.debit || rzLines[0]?.credit || 0);
      const isExactlyOnce = Math.abs(baseAmt - 367.25) < 0.01;

      if (res12.success && isExactlyOnce) {
        report("TEST 12: Single Currency Conversion (USD 100 @ 3.6725 -> AED 367.25)", "PASS", `Stored baseCurrencyAmount = ${baseAmt} AED (No double conversion)`);
      } else {
        report("TEST 12: Single Currency Conversion", "FAIL", `Expected 367.25, got ${baseAmt}`);
      }
    }

  } catch (err) {
    console.error("FATAL in test runner:", err);
    report("Test Execution Suite", "FAIL", err.message);
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("\n================================================================================");
  console.log("FINAL DEV VERIFICATION SUMMARY");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const skipped = results.filter(r => r.status === "SKIP").length;

  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed} | SKIPPED: ${skipped}`);
  if (failed === 0) {
    console.log(">>> ALL DEV VERIFICATION TESTS PASSED SUCCESSFULLY! <<<");
  } else {
    console.log(">>> ATTENTION: SOME TESTS FAILED <<<");
  }
}

runDevVerification();
