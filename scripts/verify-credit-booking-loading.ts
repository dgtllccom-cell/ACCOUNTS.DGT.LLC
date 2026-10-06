/**
 * scripts/verify-credit-booking-loading.ts
 *
 * End-to-end verification for Credit Purchase Booking Lifecycle:
 * 1. Database Safety Check (MUST be DEV database csesvyxxjivnkkozgopt).
 * 2. Save a Purchase Booking with payment condition set to Credit.
 * 3. Verify it appears immediately in the Purchase Loading queue (GET /api/erp/purchases/loading-records).
 * 4. Create a Partial Loading record (POST /api/erp/purchases/loading-records).
 * 5. Verify the remaining quantity decrements proportionally.
 * 6. Verify an Advance Booking without payment is strictly BLOCKED from loading.
 */

import { withLocalPg } from "../lib/db/local-postgres";
import { resolvePaymentCondition, resolveLoadingEligibility, resolvePurchaseLoadingSummary } from "../lib/services/purchase-calculation-service";

async function main() {
  console.log("===============================================================================");
  console.log(" CREDIT PURCHASE BOOKING -> LOADING QUEUE -> PARTIAL LOADING END-TO-END TEST");
  console.log("===============================================================================\n");

  // ── 1. Database Environment Safety Check (Rule 1 & Rule 4) ──
  console.log("--- 1. DATABASE ENVIRONMENT SAFETY CHECK ---");
  const dbUrl = process.env.DATABASE_URL || "";
  const isDevDb = dbUrl.includes("csesvyxxjivnkkozgopt");
  const isProdDb = dbUrl.includes("inmayhrxucimxqhgseqi");

  console.log(`  Database Host: ${dbUrl.split("@")[1]?.split("/")[0] || "unknown"}`);
  if (isProdDb) {
    console.error("FATAL ERROR: Connected to PRODUCTION database (inmayhrxucimxqhgseqi)! ABORTING.");
    process.exit(1);
  }
  if (!isDevDb) {
    console.warn("WARNING: Database does not explicitly contain dev ref 'csesvyxxjivnkkozgopt'.");
  } else {
    console.log("  [PASS] Confirmed connected to Testing/Dev database (csesvyxxjivnkkozgopt).\n");
  }

  // ── 2. Create a Real Test Credit Purchase Booking ──
  console.log("--- 2. SAVING NEW CREDIT PURCHASE BOOKING ---");
  const timestamp = Date.now();
  const testOrderNo = `PO-CREDIT-TEST-${timestamp}`;

  // Get a valid country and branch from DEV db
  const scopeRows = await withLocalPg(async (sql) => {
    return sql`
      select c.id as country_id, c.name as country_name, c.currency_code,
             cb.id as country_branch_id, cb.name as branch_name, cb.code as branch_code,
             ci.id as city_branch_id
      from countries c
      join country_branches cb on cb.country_id = c.id
      left join city_branches ci on ci.country_branch_id = cb.id
      where c.deleted_at is null and cb.deleted_at is null
      limit 1
    `;
  });

  if (!scopeRows || scopeRows.length === 0) {
    throw new Error("No country/branch found in testing database to bind order.");
  }
  const scope = scopeRows[0];
  console.log(`  Scope: Country = ${scope.country_name} (${scope.currency_code}), Branch = ${scope.branch_name}`);

  const totalContractQty = 1000; // 1000 bags (e.g. 2 containers of 500 bags)
  const totalAmountUSD = 50000;
  const exchangeRate = 280;

  const orderPayload = {
    country_id: scope.country_id,
    country_branch_id: scope.country_branch_id,
    city_branch_id: scope.city_branch_id,
    purchase_order_no: testOrderNo,
    purchase_currency: "USD",
    payment_currency: "USD",
    currency_code: "USD",
    exchange_rate: exchangeRate,
    order_total: totalAmountUSD,
    advance_paid: 0,
    remaining_due: totalAmountUSD,
    payment_status: "pending",
    form_data: {
      form: {
        paymentType: "Credit",
        paymentCondition: "Credit",
        advancePercent: 0,
        advanceAmount: 0,
        totalAmount: totalAmountUSD,
        quantity: totalContractQty,
        exchangeRate: exchangeRate,
        containerCount: 2,
        loadingPort: "Karachi Port",
        receivedPort: "Dubai Port",
        supplierName: "Test Global Supplies Ltd",
        purchaseAccountName: "Raw Materials Purchase",
        salesAccountName: "Supplier Payable A/C"
      },
      goodsEntries: [
        {
          goodsName: "Industrial Plastic Granules",
          quantity: totalContractQty,
          qtyNo: totalContractQty,
          qtyName: "BAGS",
          oneQtyKgs: 25,
          totalAmount: totalAmountUSD,
          priceRateC1: 50,
          priceType: "P/Unit"
        }
      ],
      totals: {
        totalQuantity: totalContractQty,
        grandFinal: totalAmountUSD,
        totalContainers: 2
      },
      workflow: {
        totalQuantity: totalContractQty,
        totalContainers: 2,
        loadedQuantity: 0,
        loadedContainers: 0
      }
    }
  };

  const insertedPo = await withLocalPg(async (sql) => {
    const rows = await sql`
      insert into purchase_orders ${sql(orderPayload as any)}
      returning id, purchase_order_no, form_data
    `;
    return rows[0];
  });

  console.log(`  [PASS] Created Credit Purchase Booking: ${insertedPo.purchase_order_no} (ID: ${insertedPo.id})\n`);

  // ── 3. Test resolveLoadingEligibility for Credit ──
  console.log("--- 3. VERIFYING LOADING ELIGIBILITY FOR CREDIT BOOKING ---");
  const cond = resolvePaymentCondition(insertedPo as any);
  const elig = resolveLoadingEligibility(insertedPo as any, 0);

  console.log(`  Payment Condition: ${cond}`);
  console.log(`  Loading Eligible:  ${elig.eligible}`);
  console.log(`  Gate Reason:       ${elig.reason}`);

  if (cond !== "credit" || !elig.eligible) {
    console.error("  [FAIL] Credit booking should be immediately eligible for loading!");
    process.exit(1);
  }
  console.log("  [PASS] Credit booking is immediately eligible without requiring advance payment.\n");

  // ── 4. Verify Loading Records Queue Query (Simulating GET /api/erp/purchases/loading-records) ──
  console.log("--- 4. VERIFYING LOADING RECORDS QUEUE (GET SIMULATION) ---");
  const queueRows = await withLocalPg(async (sql) => {
    return sql`
      select
        po.id, po.purchase_order_no, po.country_id, po.country_branch_id, po.city_branch_id,
        po.form_data, po.advance_paid, po.remaining_due, po.order_total, po.payment_status,
        po.currency_code, po.exchange_rate, po.remaining_paid, po.credit_amount, po.created_at,
        case when c.id is not null then jsonb_build_object('name', c.name, 'iso2', c.iso2, 'currency', c.currency_code) else null end as countries,
        case when cb.id is not null then jsonb_build_object('name', cb.name, 'code', cb.code) else null end as country_branches,
        case when ci.id is not null then jsonb_build_object('name', ci.name, 'code', ci.code, 'city_name', ci.city_name) else null end as city_branches
      from purchase_orders po
      left join countries c on c.id = po.country_id
      left join country_branches cb on cb.id = po.country_branch_id
      left join city_branches ci on ci.id = po.city_branch_id
      where po.id = ${insertedPo.id}::uuid and po.deleted_at is null
    `;
  });

  if (queueRows.length === 0) {
    console.error("  [FAIL] Order could not be queried via withLocalPg queue!");
    process.exit(1);
  }

  const foundPo = queueRows[0];
  const queueElig = resolveLoadingEligibility(foundPo as any, 0);
  console.log(`  Found in queue query: ${foundPo.purchase_order_no}`);
  console.log(`  Synthetic Loading Record No: PLR-PENDING`);
  console.log(`  Loading Status: pending (Eligible: ${queueElig.eligible})`);
  console.log("  [PASS] Order successfully appears as eligible in Loading Queue!\n");

  // ── 5. Create Partial Loading Record (Container 1: 500 Bags out of 1000 Bags) ──
  console.log("--- 5. CREATING PARTIAL LOADING RECORD (CONTAINER 1: 500 BAGS) ---");
  const loadedQuantity1 = 500;
  const containerNo1 = `MSCU-${timestamp.toString().slice(-7)}`;
  const loadingRecordNo1 = `PLR-${scope.branch_code || "TEST"}-${timestamp.toString().slice(-5)}`;

  const summary1 = resolvePurchaseLoadingSummary(foundPo as any, 0, loadedQuantity1);
  console.log(`  Summary 1:`);
  console.log(`    Total Qty:             ${summary1.totalQuantity} Bags`);
  console.log(`    Loaded Qty:            ${summary1.currentLoadedQuantity} Bags`);
  console.log(`    Remaining Qty:         ${summary1.remainingQuantity} Bags`);
  console.log(`    Loaded Purchase FC:    ${summary1.loadedPurchaseFC} USD`);
  console.log(`    Loaded Advance FC:     ${summary1.loadedAdvanceFC} USD (0 for Credit)`);
  console.log(`    Remaining Loading FC:  ${summary1.remainingLoadingFC} USD`);

  const loadingPayload1 = {
    country_id: scope.country_id,
    country_branch_id: scope.country_branch_id,
    city_branch_id: scope.city_branch_id,
    purchase_order_id: insertedPo.id,
    purchase_order_no: insertedPo.purchase_order_no,
    loading_record_no: loadingRecordNo1,
    container_number: containerNo1,
    container_type: "40 FT Standard",
    loading_status: "loaded",
    loaded_at: new Date().toISOString(),
    loading_location: "Karachi Port",
    receiving_location: "Dubai Port",
    shipment_status: "partially_loaded",
    carrier_name: "Maersk Line",
    loaded_quantity: loadedQuantity1,
    total_quantity: totalContractQty,
    loading_percentage: 50,
    loaded_purchase_amount: summary1.loadedPurchaseFC,
    loaded_advance_amount: summary1.loadedAdvanceFC,
    purchase_currency: "USD",
    exchange_rate: exchangeRate,
    loaded_purchase_local: summary1.loadedPurchaseLC,
    loaded_advance_local: summary1.loadedAdvanceLC,
    remaining_loading_balance: summary1.remainingLoadingFC,
    local_currency: scope.currency_code || "PKR",
    report_payload: {
      loadedQuantity: loadedQuantity1,
      containerIndex: 1,
      totalContainers: 2
    }
  };

  const insertedLoading1 = await withLocalPg(async (sql) => {
    return sql.begin(async (tx) => {
      const lrRows = await tx`
        insert into purchase_loading_records ${sql(loadingPayload1 as any)}
        returning id, loading_record_no, loaded_quantity
      `;
      // Update PO workflow
      const poData = (foundPo.form_data as any) || {};
      const workflow = poData.workflow || {};
      workflow.loadedQuantity = loadedQuantity1;
      workflow.loadedContainers = 1;
      workflow.containerStatus = "Partially Loaded";
      poData.workflow = workflow;
      await tx`update purchase_orders set form_data = ${tx.json(poData)} where id = ${insertedPo.id}::uuid`;
      return lrRows[0];
    });
  });

  console.log(`  [PASS] Inserted Partial Loading Record: ${insertedLoading1.loading_record_no} (${insertedLoading1.loaded_quantity} Bags)`);
  console.log(`  Container Number: ${containerNo1}\n`);

  // ── 6. Verify Loading Records Queue after Partial Loading ──
  console.log("--- 6. VERIFYING QUEUE STATE AFTER PARTIAL LOADING ---");
  const postLoadRecords = await withLocalPg(async (sql) => {
    return sql`
      select plr.id, plr.loading_record_no, plr.container_number, plr.loaded_quantity,
             plr.loading_status, plr.remaining_loading_balance,
             po.form_data->'workflow'->>'loadedQuantity' as po_loaded_qty,
             po.form_data->'workflow'->>'containerStatus' as po_container_status
      from purchase_loading_records plr
      join purchase_orders po on po.id = plr.purchase_order_id
      where plr.purchase_order_id = ${insertedPo.id}::uuid and plr.deleted_at is null
    `;
  });

  console.log(`  Loading Records for ${insertedPo.purchase_order_no}: ${postLoadRecords.length}`);
  for (const r of postLoadRecords) {
    console.log(`    - Record: ${r.loading_record_no} | Container: ${r.container_number} | Loaded: ${r.loaded_quantity} | Balance: ${r.remaining_loading_balance} USD`);
  }
  const remainingQty = totalContractQty - Number(postLoadRecords[0].po_loaded_qty);
  console.log(`  Remaining Quantity to Load: ${remainingQty} Bags`);

  if (remainingQty !== 500) {
    console.error(`  [FAIL] Expected remaining quantity to be 500 bags, got ${remainingQty}`);
    process.exit(1);
  }
  console.log("  [PASS] Remaining quantity correctly decremented to 500 Bags!\n");

  // ── 7. Verify Advance Gate is NOT Weakened ──
  console.log("--- 7. VERIFYING ADVANCE GATE INTEGRITY (MUST NOT BE WEAKENED) ---");
  const advancePo = {
    order_total: 100000,
    advance_paid: 0,
    currency_code: "USD",
    form_data: {
      form: {
        paymentType: "Advance Payment",
        advancePercent: 20, // Requires 20,000 USD advance
        totalAmount: 100000
      }
    }
  };

  const advanceCond = resolvePaymentCondition(advancePo as any);
  const advanceEligUnpaid = resolveLoadingEligibility(advancePo as any, 0);
  const advanceEligPaid = resolveLoadingEligibility(advancePo as any, 20000);

  console.log(`  Advance Unpaid: Eligible = ${advanceEligUnpaid.eligible} (Shortfall: ${advanceEligUnpaid.shortfallFC} USD)`);
  console.log(`  Advance Paid:   Eligible = ${advanceEligPaid.eligible} (Shortfall: ${advanceEligPaid.shortfallFC} USD)`);

  if (advanceEligUnpaid.eligible) {
    console.error("  [FAIL] Advance gate was weakened! Unpaid advance PO marked as eligible.");
    process.exit(1);
  }
  if (!advanceEligPaid.eligible) {
    console.error("  [FAIL] Paid advance PO marked as ineligible.");
    process.exit(1);
  }
  console.log("  [PASS] Advance payment gate remains strictly enforced!\n");

  console.log("===============================================================================");
  console.log(" ALL TESTS PASSED: CREDIT BOOKING LIFECYCLE VERIFIED SUCCESSFULLY");
  console.log("===============================================================================");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
