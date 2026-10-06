import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const TARGET_REF = "csesvyxxjivnkkozgopt";
const PROD_REF = "inmayhrxucimxqhgseqi";
const DEFAULT_START_DATE = "2026-08-01";
const DEFAULT_END_DATE = "2026-08-16";
const DEFAULT_PURCHASES_PER_DAY = 12;
const DEFAULT_CASH_PER_DAY = 22;

function parseArgs(argv) {
  const get = (name, fallback = null) => {
    const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
    return hit ? hit.split("=").slice(1).join("=") : fallback;
  };

  return {
    confirmLocalDev: argv.includes("--confirm-local-dev"),
    commit: argv.includes("--commit"),
    dryRun: argv.includes("--dry-run") || !argv.includes("--commit"),
    environment: String(get("environment", "LOCAL")).trim().toUpperCase(),
    sourceTag: String(get("source-tag", "")).trim(),
    databaseUrl: String(get("database-url", "")).trim(),
    expectedRef: String(get("expected-ref", TARGET_REF)).trim(),
    startDate: String(get("start-date", DEFAULT_START_DATE)).trim(),
    endDate: String(get("end-date", DEFAULT_END_DATE)).trim(),
    purchasesPerDay: Number(get("purchases-per-day", DEFAULT_PURCHASES_PER_DAY)),
    cashPerDay: Number(get("cash-per-day", DEFAULT_CASH_PER_DAY)),
  };
}

async function loadEnvFile(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Optional.
  }
}

function extractSupabaseRef(url) {
  if (!url) return null;
  const match = String(url).match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?/i);
  return match?.[1] ?? null;
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function money(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) throw new Error(`Invalid numeric value: ${value}`);
  return Math.round(numeric * 10000) / 10000;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dayRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(new Date(d).toISOString().slice(0, 10));
  }
  return days;
}

function currencyForCountry(countryName, iso2) {
  const key = normalize(countryName || iso2);
  if (key.includes("emirates") || key === "ae") return "AED";
  if (key.includes("pakistan") || key === "pk") return "PKR";
  if (key.includes("afghanistan") || key === "af") return "AFN";
  if (key.includes("india") || key === "in") return "INR";
  return "USD";
}

function dailyRateFor(currencyCode, dayIndex) {
  const code = normalize(currencyCode).toUpperCase();
  const shift = (dayIndex % 5) * 0.01;
  if (code === "AED") return { buying: 3.6400 + shift, selling: 3.6600 + shift, credit: 3.6500 + shift, debit: 3.6700 + shift };
  if (code === "PKR") return { buying: 278.00 + (dayIndex % 7) * 0.15, selling: 279.50 + (dayIndex % 7) * 0.15, credit: 279.00 + (dayIndex % 7) * 0.15, debit: 280.00 + (dayIndex % 7) * 0.15 };
  if (code === "AFN") return { buying: 70.80 + (dayIndex % 6) * 0.07, selling: 71.20 + (dayIndex % 6) * 0.07, credit: 71.00 + (dayIndex % 6) * 0.07, debit: 71.40 + (dayIndex % 6) * 0.07 };
  if (code === "INR") return { buying: 83.25 + (dayIndex % 6) * 0.05, selling: 83.60 + (dayIndex % 6) * 0.05, credit: 83.40 + (dayIndex % 6) * 0.05, debit: 83.75 + (dayIndex % 6) * 0.05 };
  return { buying: 1.05 + shift, selling: 1.10 + shift, credit: 1.08 + shift, debit: 1.12 + shift };
}

function buildPurchaseOrderNo(sourceTag, day, index) {
  return `${sourceTag}-PO-${day.replace(/-/g, "")}-${pad2(index)}`;
}

function buildCashReference(sourceTag, day, index) {
  return `${sourceTag}-CASH-${day.replace(/-/g, "")}-${pad2(index)}`;
}

function buildLoadingRecordNo(sourceTag, day, index) {
  return `${sourceTag}-LOAD-${day.replace(/-/g, "")}-${pad2(index)}`;
}

function buildJournalNo(sourceTag, day, index) {
  return `${sourceTag}-JRN-${day.replace(/-/g, "")}-${pad2(index)}`;
}

function buildVoucherNo(sourceTag, day, index) {
  return `${sourceTag}-VCH-${day.replace(/-/g, "")}-${pad2(index)}`;
}

function buildOrderItems(dayIndex, orderIndex, currencyCode, branchLabel) {
  const itemPool = [
    { goods: "ALMONDS GIRI CALIFORNIA 20/22", hs: "080212", size: "20/22" },
    { goods: "WALNUT KERNEL SIALKOT SUPER 2026", hs: "080232", size: "SUPER" },
    { goods: "CASHEW NUTS WHOLE W320 PREMIUM", hs: "080132", size: "W320" },
    { goods: "PISTACHIO SHELLED EXTRA FINE GRADE A", hs: "080251", size: "A" },
    { goods: "GREEN RAISINS KANDAHAR PREMIUM", hs: "080620", size: "PREMIUM" },
    { goods: "DATES MEDJOOL LARGE SELECT", hs: "080410", size: "LARGE" },
  ];
  const base = itemPool[(dayIndex + orderIndex) % itemPool.length];
  const second = itemPool[(dayIndex + orderIndex + 2) % itemPool.length];
  const quantities = [10 + ((dayIndex + orderIndex) % 4) * 5, 5 + ((dayIndex + orderIndex) % 3) * 5];
  const rate1 = currencyCode === "USD" ? 8.5 + (orderIndex % 4) * 0.75 : 30 + (orderIndex % 4) * 8;
  const rate2 = currencyCode === "USD" ? 6.5 + (orderIndex % 4) * 0.5 : 24 + (orderIndex % 4) * 6;
  return [
    {
      goods_name: `${base.goods} - DEV TEST`,
      hs_code: base.hs,
      size: `${base.size}-${branchLabel}`,
      brand: "Digital DGT LLC",
      origin: branchLabel,
      quantity: quantities[0],
      unit_name: "carton",
      unit_weight: 10,
      gross_weight: quantities[0] * 10,
      net_weight: quantities[0] * 9.8,
      rate_original: rate1,
      rate_local: rate1,
      rate_usd: currencyCode === "USD" ? rate1 : rate1 / 3.67,
      total_original: quantities[0] * rate1,
      total_local: quantities[0] * rate1,
      total_usd: currencyCode === "USD" ? quantities[0] * rate1 : (quantities[0] * rate1) / 3.67,
    },
    {
      goods_name: `${second.goods} - DEV TEST`,
      hs_code: second.hs,
      size: `${second.size}-${branchLabel}`,
      brand: "Digital DGT LLC",
      origin: branchLabel,
      quantity: quantities[1],
      unit_name: "carton",
      unit_weight: 10,
      gross_weight: quantities[1] * 10,
      net_weight: quantities[1] * 9.8,
      rate_original: rate2,
      rate_local: rate2,
      rate_usd: currencyCode === "USD" ? rate2 : rate2 / 3.67,
      total_original: quantities[1] * rate2,
      total_local: quantities[1] * rate2,
      total_usd: currencyCode === "USD" ? quantities[1] * rate2 : (quantities[1] * rate2) / 3.67,
    }
  ];
}

async function main() {
  await loadEnvFile(path.join(process.cwd(), ".env.local"));
  await loadEnvFile(path.join(process.cwd(), ".env"));
  const args = parseArgs(process.argv.slice(2));

  const sourceTag = args.sourceTag || `${args.environment}-LOADTEST-AUG2026-R01`;
  const databaseUrl = args.databaseUrl || process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = extractSupabaseRef(supabaseUrl);
  const prodRef = process.env.PROD_SUPABASE_REF?.trim() || PROD_REF;
  const devRef = process.env.DEV_SUPABASE_REF?.trim() || TARGET_REF;

  if (!args.confirmLocalDev) {
    throw new Error("Missing --confirm-local-dev. Refusing to run without explicit local-dev confirmation.");
  }
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("Refusing to run in a production-like NODE_ENV/APP_ENV.");
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing.");
  }
  if (args.environment === "LOCAL") {
    if (ref !== TARGET_REF) {
      throw new Error(`Supabase ref mismatch: expected ${TARGET_REF}, got ${ref ?? "null"}.`);
    }
    if (ref === prodRef || supabaseUrl.includes(prodRef) || databaseUrl.includes(prodRef)) {
      throw new Error(`Ref ${ref} matches production ref ${prodRef}; refusing to proceed.`);
    }
    if (devRef !== TARGET_REF) {
      throw new Error(`DEV_SUPABASE_REF mismatch: expected ${TARGET_REF}, got ${devRef}.`);
    }
    if (!databaseUrl.includes(TARGET_REF)) {
      throw new Error("DATABASE_URL does not point at the authorized dev project ref.");
    }
  } else if (args.environment === "EPS") {
    if (!args.expectedRef) {
      throw new Error("EPS mode requires --expected-ref.");
    }
    if (ref && ref !== args.expectedRef) {
      throw new Error(`EPS ref mismatch: expected ${args.expectedRef}, got ${ref}.`);
    }
  }

  const sql = postgres(databaseUrl, { max: 4, prepare: false, connect_timeout: 30 });

  const dateList = dayRange(args.startDate, args.endDate);
  const targetCountryNames = ["United Arab Emirates", "Pakistan", "Afghanistan", "India"];

  console.log("=======================================================================");
  console.log("  BULK PURCHASE / CASH LOADTEST GENERATOR");
  console.log("=======================================================================");
  console.log(`  Environment: ${args.environment}`);
  console.log(`  Target ref: ${ref ?? "(not parsed)"}`);
  console.log(`  Database: ${databaseUrl.replace(/:([^:@]+)@/, ":****@")}`);
  console.log(`  Source tag: ${sourceTag}`);
  console.log(`  Date range: ${args.startDate} → ${args.endDate}`);
  console.log(`  Purchases/day: ${args.purchasesPerDay}`);
  console.log(`  Cash entries/day: ${args.cashPerDay}`);
  console.log(`  Dry run: ${args.dryRun ? "yes" : "no"}`);

  const countries = await sql`
    select id, name, coalesce(nullif(iso2,''), nullif(iso3,'')) as iso2, currency_code
    from countries
    where deleted_at is null
      and name = any(${targetCountryNames})
    order by name
  `;
  if (countries.length === 0) {
    throw new Error("No target countries found.");
  }
  console.log(`  Countries found: ${countries.map((row) => row.name).join(", ")}`);

  const countryIds = countries.map((row) => row.id);
  const countryBranches = await sql`
    select id, country_id, name, code, local_currency, owner_name
    from country_branches
    where deleted_at is null
      and country_id = any(${countryIds})
    order by country_id, name
  `;
  const cityBranches = await sql`
    select id, country_id, country_branch_id, city_name, name, code, local_currency
    from city_branches
    where deleted_at is null
      and country_id = any(${countryIds})
    order by country_id, name
  `;
  const profiles = await sql`
    select p.id, p.full_name, p.user_code, ura.role::text as role, ura.country_id, ura.country_branch_id, ura.city_branch_id
    from profiles p
    join user_role_assignments ura on ura.user_id = p.id
    where ura.is_active = true
      and (
        ura.country_id = any(${countryIds})
        or ura.country_id is null
      )
  `;
  const companies = await sql`
    select id, country_id, name
    from companies
    where deleted_at is null
      and (country_id = any(${countryIds}) or country_id is null)
    order by name
  `;
  const ledgers = await sql`
    select id, scope, country_id, country_branch_id, city_branch_id, code, name, currency
    from ledgers
    where deleted_at is null
      and (
        country_id = any(${countryIds})
        or country_id is null
      )
    order by scope, country_id nulls last, country_branch_id nulls last, city_branch_id nulls last, name
  `;

  const branchScopes = [];
  for (const country of countries) {
    const city = cityBranches.filter((row) => row.country_id === country.id);
    const mains = countryBranches.filter((row) => row.country_id === country.id);
    if (city.length) {
      for (const cb of city) {
        branchScopes.push({
          scopeType: "city_branch",
          countryId: country.id,
          countryName: country.name,
          countryCode: country.iso2 || currencyForCountry(country.name, country.iso2),
          countryBranchId: cb.country_branch_id,
          countryBranchName: countryBranches.find((r) => r.id === cb.country_branch_id)?.name ?? null,
          cityBranchId: cb.id,
          cityBranchName: cb.name,
          branchLabel: cb.name,
          branchCode: cb.code,
          currency: cb.local_currency || currencyForCountry(country.name, country.iso2),
          actor: profiles.find((p) => p.city_branch_id === cb.id && normalize(p.role).includes("city_branch_admin"))
            || profiles.find((p) => p.country_branch_id === cb.country_branch_id && normalize(p.role).includes("main_branch_admin"))
            || profiles.find((p) => p.country_id === country.id && normalize(p.role).includes("country_admin"))
            || profiles.find((p) => normalize(p.role).includes("super_admin"))
        });
      }
    } else if (mains.length) {
      for (const cb of mains) {
        branchScopes.push({
          scopeType: "main_branch",
          countryId: country.id,
          countryName: country.name,
          countryCode: country.iso2 || currencyForCountry(country.name, country.iso2),
          countryBranchId: cb.id,
          countryBranchName: cb.name,
          cityBranchId: null,
          cityBranchName: null,
          branchLabel: cb.name,
          branchCode: cb.code,
          currency: cb.local_currency || currencyForCountry(country.name, country.iso2),
          actor: profiles.find((p) => p.country_branch_id === cb.id && normalize(p.role).includes("main_branch_admin"))
            || profiles.find((p) => p.country_id === country.id && normalize(p.role).includes("country_admin"))
            || profiles.find((p) => normalize(p.role).includes("super_admin"))
        });
      }
    }
  }

  if (!branchScopes.length) {
    throw new Error("No branch scopes were found for the target countries.");
  }

  const missingActors = branchScopes.filter((row) => !row.actor);
  if (missingActors.length > 0) {
    throw new Error(`Missing DEV branch actors for: ${missingActors.map((row) => row.branchLabel).join(", ")}`);
  }

  const purchaseLedgerPatterns = [/purchase/i, /inventory/i, /stock/i, /goods/i, /expense/i];
  const cashLedgerPatterns = [/cash/i, /bank/i];
  const payableLedgerPatterns = [/payable/i, /supplier/i, /creditor/i];
  const receivableLedgerPatterns = [/receivable/i, /customer/i, /debtor/i];

  function pickLedger(branch, patterns, fallbackPatterns = []) {
    const scopeRows = ledgers.filter((row) =>
      row.city_branch_id === branch.cityBranchId ||
      row.country_branch_id === branch.countryBranchId ||
      row.country_id === branch.countryId ||
      (!row.country_id && !row.country_branch_id && !row.city_branch_id)
    );
    const scan = [...patterns, ...fallbackPatterns];
    for (const regex of scan) {
      const found = scopeRows.find((row) => regex.test(String(row.name || "")) || regex.test(String(row.code || "")));
      if (found) return found;
    }
    return null;
  }

  const selectedBranches = branchScopes.map((branch, index) => ({
    ...branch,
    orderBias: index
  }));

  const ledgerPlans = selectedBranches.map((branch) => {
    const purchaseLedger = pickLedger(branch, purchaseLedgerPatterns, payableLedgerPatterns);
    const cashLedger = pickLedger(branch, cashLedgerPatterns, receivableLedgerPatterns);
    const bankLedger = pickLedger(branch, [/bank/i], cashLedgerPatterns);
    const payableLedger = pickLedger(branch, payableLedgerPatterns, purchaseLedgerPatterns);
    const receivableLedger = pickLedger(branch, receivableLedgerPatterns, payableLedgerPatterns);
    return {
      branch,
      purchaseLedger,
      cashLedger,
      bankLedger,
      payableLedger,
      receivableLedger
    };
  });

  const unresolvedLedgers = ledgerPlans.filter((row) => !row.purchaseLedger || !row.cashLedger || !row.payableLedger);
  if (unresolvedLedgers.length > 0) {
    console.log("Ledger preflight warning: some branches are missing an expected ledger match.");
    console.table(unresolvedLedgers.map((row) => ({
      branch: row.branch.branchLabel,
      purchaseLedger: row.purchaseLedger?.name ?? "MISSING",
      cashLedger: row.cashLedger?.name ?? "MISSING",
      bankLedger: row.bankLedger?.name ?? "MISSING",
      payableLedger: row.payableLedger?.name ?? "MISSING",
      receivableLedger: row.receivableLedger?.name ?? "MISSING"
    })));
    throw new Error("Required ledgers were not found for at least one branch. Please seed/confirm canonical ledgers before running the bulk load.");
  }

  const duplicateLedgerPlans = ledgerPlans.filter((row) => {
    const ids = [row.purchaseLedger?.id, row.cashLedger?.id, row.bankLedger?.id, row.payableLedger?.id, row.receivableLedger?.id].filter(Boolean);
    return new Set(ids).size !== ids.length;
  });
  if (duplicateLedgerPlans.length > 0) {
    console.table(duplicateLedgerPlans.map((row) => ({
      branch: row.branch.branchLabel,
      purchaseLedger: row.purchaseLedger?.name ?? "-",
      cashLedger: row.cashLedger?.name ?? "-",
      bankLedger: row.bankLedger?.name ?? "-",
      payableLedger: row.payableLedger?.name ?? "-",
      receivableLedger: row.receivableLedger?.name ?? "-"
    })));
    throw new Error("Some branches resolve the same ledger for multiple roles. Please seed distinct canonical ledgers before running the bulk load.");
  }

  console.log(`  Branch scopes found: ${selectedBranches.length}`);
  console.log(`  Profiles available: ${profiles.length}`);
  console.log(`  Companies available: ${companies.length}`);
  console.log(`  Ledgers available: ${ledgers.length}`);
  console.table(selectedBranches.map((row) => ({
    branch: row.branchLabel,
    scope: row.scopeType,
    actor: row.actor.full_name || row.actor.user_code || row.actor.id,
    purchaseLedger: ledgerPlans.find((p) => p.branch.branchCode === row.branchCode)?.purchaseLedger?.name,
    cashLedger: ledgerPlans.find((p) => p.branch.branchCode === row.branchCode)?.cashLedger?.name,
    bankLedger: ledgerPlans.find((p) => p.branch.branchCode === row.branchCode)?.bankLedger?.name
  })));

  const goodsCatalog = [
    "ALMONDS GIRI CALIFORNIA 20/22",
    "WALNUT KERNEL SIALKOT SUPER 2026",
    "CASHEW NUTS WHOLE W320 PREMIUM",
    "PISTACHIO SHELLED EXTRA FINE GRADE A",
    "GREEN RAISINS KANDAHAR PREMIUM",
    "DATES MEDJOOL LARGE SELECT"
  ];

  const batchCounters = {
    purchaseOrders: 0,
    purchaseItems: 0,
    payments: 0,
    loadingRecords: 0,
    cashEntries: 0,
    rates: 0,
    skippedPurchaseOrders: 0,
    skippedPayments: 0,
    skippedLoadingRecords: 0,
    skippedCashEntries: 0,
    skippedRates: 0
  };

  const purchaseCountByDay = new Map();
  const cashCountByDay = new Map();
  const perBranchCounts = new Map();

  async function setActor(tx, actorId) {
    await tx`
      select set_config(
        'request.jwt.claims',
        json_build_object('sub', ${actorId}::text, 'role', 'authenticated')::text,
        true
      )
    `;
  }

  async function ensureDailyRate(tx, branch, day, dayIndex, actorId) {
    const rate = dailyRateFor(branch.currency, dayIndex);
    const existing = await tx`
      select id
      from daily_usd_rates
      where deleted_at is null
        and country_id = ${branch.countryId}
        and country_branch_id is null
        and rate_date = ${day}::date
      limit 1
    `;
    if (existing[0]) {
      await tx`
        update daily_usd_rates
        set buying_rate = ${rate.buying},
            selling_rate = ${rate.selling},
            credit_rate = ${rate.credit},
            debit_rate = ${rate.debit},
            entered_by = ${actorId},
            approved_by = ${actorId},
            approved_at = now(),
            updated_at = now()
        where id = ${existing[0].id}
      `;
      batchCounters.skippedRates += 1;
      return;
    }

    await tx`
      insert into daily_usd_rates (
        country_id, country_branch_id, rate_date,
        buying_rate, selling_rate, credit_rate, debit_rate,
        entered_by, approved_by, approved_at, created_at, updated_at
      ) values (
        ${branch.countryId},
        null,
        ${day}::date,
        ${rate.buying},
        ${rate.selling},
        ${rate.credit},
        ${rate.debit},
        ${actorId},
        ${actorId},
        ${day}::date + interval '9 hours',
        ${day}::date + interval '9 hours',
        ${day}::date + interval '9 hours'
      )
    `;
    batchCounters.rates += 1;
  }

  async function createPurchaseOrder(tx, branch, day, dayIndex, orderIndex, actorId) {
    const purchaseNo = buildPurchaseOrderNo(sourceTag, day, `${dayIndex + 1}${orderIndex + 1}`);
    const dateIso = `${day}T08:${pad2((orderIndex * 3) % 60)}:00.000Z`;
    const currencyCode = (dayIndex + orderIndex) % 4 === 0 ? "USD" : branch.currency;
    const exchangeRate = currencyCode === "USD" ? dailyRateFor(branch.currency, dayIndex).debit : 1;
    const items = buildOrderItems(dayIndex, orderIndex, currencyCode, branch.branchCode);
    const orderTotal = money(items.reduce((sum, item) => sum + money(item.total_original), 0));
    const totalQuantity = money(items.reduce((sum, item) => sum + money(item.quantity), 0));
    const halfQuantity = money(totalQuantity / 2);
    const existing = await tx`
      select id
      from purchase_orders
      where deleted_at is null
        and purchase_order_no = ${purchaseNo}
      limit 1
    `;
    if (existing[0]) {
      batchCounters.skippedPurchaseOrders += 1;
      return { id: existing[0].id, purchaseOrderNo: purchaseNo, created: false, currencyCode, exchangeRate, orderTotal, totalQuantity, halfQuantity };
    }

    const formData = {
      seedTag: sourceTag,
      testBatch: sourceTag,
      businessDate: day,
      form: {
        billNo: purchaseNo,
        supplierName: branch.branchLabel,
        currencyCode,
        exchangeRate
      },
      goodsEntries: items.map((item, idx) => ({
        line: idx + 1,
        goodsName: item.goods_name,
        brand: item.brand,
        size: item.size,
        qtyNo: item.quantity,
        unitName: item.unit_name,
        unitWeight: item.unit_weight,
        grossWeight: item.gross_weight,
        netWeight: item.net_weight,
        totalOriginal: item.total_original,
        rateOriginal: item.rate_original
      })),
      totals: {
        totalQuantity,
        totalOriginal: orderTotal,
        totalLocal: currencyCode === "USD" ? money(orderTotal * exchangeRate) : orderTotal,
        totalUsd: currencyCode === "USD" ? orderTotal : money(orderTotal / exchangeRate)
      },
      workflow: {
        sourceTag,
        paymentStatus: "pending",
        paymentMode: "pending",
        totalQuantity,
        loadedQuantity: 0,
        remainingQuantity: totalQuantity,
        stockStage: "booking",
        stockStatus: "RED"
      }
    };

    const supplier = companies[(dayIndex * args.purchasesPerDay + orderIndex) % companies.length] || null;
    const createdAt = `${day}T09:${pad2(orderIndex % 60)}:00.000Z`;

    const inserted = await tx`
      insert into purchase_orders (
        country_id, country_branch_id, city_branch_id,
        purchase_order_no, purchase_contract_no, supplier_company_id,
        purchase_currency, payment_currency, currency_code, exchange_rate, order_total,
        total_goods_original, total_goods_local, total_goods_usd,
        total_expenses_original, total_expenses_local, total_expenses_usd,
        landed_cost_original, landed_cost_local, landed_cost_usd,
        payment_status, ledger_posting_status, advance_paid, remaining_paid, credit_amount, remaining_due,
        form_data, created_by, created_at, updated_at
      ) values (
        ${branch.countryId},
        ${branch.countryBranchId ?? null},
        ${branch.cityBranchId ?? null},
        ${purchaseNo},
        ${`${sourceTag}-CON-${day.replace(/-/g, "")}-${pad2(orderIndex + 1)}`},
        ${supplier?.id ?? null},
        ${currencyCode},
        ${branch.currency},
        ${currencyCode},
        ${exchangeRate},
        ${orderTotal},
        ${orderTotal},
        ${currencyCode === "USD" ? money(orderTotal * exchangeRate) : orderTotal},
        ${currencyCode === "USD" ? orderTotal : money(orderTotal / exchangeRate)},
        0,
        0,
        0,
        ${orderTotal},
        ${currencyCode === "USD" ? money(orderTotal * exchangeRate) : orderTotal},
        ${currencyCode === "USD" ? orderTotal : money(orderTotal / exchangeRate)},
        'pending',
        'draft',
        0,
        0,
        0,
        ${orderTotal},
        ${JSON.stringify(formData)}::jsonb,
        ${actorId},
        ${createdAt},
        ${createdAt}
      )
      returning id
    `;
    const orderId = inserted[0].id;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      await tx`
        insert into purchase_order_items (
          purchase_order_id, goods_name, hs_code, size, brand, origin,
          quantity, unit_name, unit_weight, gross_weight, net_weight,
          rate_original, rate_local, rate_usd, total_original, total_local, total_usd,
          created_at, updated_at
        ) values (
          ${orderId},
          ${item.goods_name},
          ${item.hs_code},
          ${item.size},
          ${item.brand},
          ${item.origin},
          ${item.quantity},
          ${item.unit_name},
          ${item.unit_weight},
          ${item.gross_weight},
          ${item.net_weight},
          ${item.rate_original},
          ${item.rate_local},
          ${item.rate_usd},
          ${item.total_original},
          ${item.total_local},
          ${item.total_usd},
          ${createdAt},
          ${createdAt}
        )
      `;
      batchCounters.purchaseItems += 1;
    }

    batchCounters.purchaseOrders += 1;
    return { id: orderId, purchaseOrderNo: purchaseNo, created: true, currencyCode, exchangeRate, orderTotal, totalQuantity, halfQuantity };
  }

  async function postPurchasePayment(tx, branch, order, day, dayIndex, orderIndex, actorId, kind, amount, debitLedger, creditLedger, suffix) {
    const referenceNo = `${sourceTag}-PAY-${order.purchaseOrderNo}-${suffix}`;
    const existing = await tx`
      select id
      from purchase_order_payments
      where deleted_at is null
        and purchase_order_id = ${order.id}
        and reference_no = ${referenceNo}
      limit 1
    `;
    if (existing[0]) {
      batchCounters.skippedPayments += 1;
      return existing[0].id;
    }

    const entryDate = day;
    const narration = `${sourceTag} ${kind.toUpperCase()} payment for ${order.purchaseOrderNo}`;
    const paymentId = await tx`
      select post_purchase_booking_transfer(
        ${actorId},
        ${order.id},
        ${kind}::purchase_order_payment_kind,
        ${entryDate}::date,
        ${amount},
        ${order.currencyCode},
        ${order.exchangeRate},
        ${debitLedger.id},
        ${creditLedger.id},
        ${referenceNo},
        ${narration}
      ) as payment_id
    `;
    batchCounters.payments += 1;
    return paymentId[0].payment_id;
  }

  async function createOrMoveLoading(tx, branch, order, day, dayIndex, orderIndex, actorId, finalStage) {
    const loadingNo = buildLoadingRecordNo(sourceTag, day, `${dayIndex + 1}${orderIndex + 1}`);
    const existing = await tx`
      select id
      from purchase_loading_records
      where deleted_at is null
        and loading_record_no = ${loadingNo}
      limit 1
    `;
    const totalQty = order.totalQuantity;
    const loadedQty = finalStage === "remaining" ? money(totalQty / 2) : totalQty;
    const payload = {
      seedTag: sourceTag,
      lifecycleStage: finalStage,
      stockStage: finalStage === "remaining" ? "Remaining Stock" : (finalStage === "land" ? "Land Stock" : finalStage),
      stockStatus: ["warehouse", "export", "re-export", "local-sale"].includes(finalStage) ? "BLACK" : "RED",
      paymentProofComplete: finalStage !== "remaining",
      paymentProofStatus: finalStage !== "remaining" ? "completed" : "pending",
      paymentRemainingDue: finalStage === "remaining" ? money(order.orderTotal * 0.5) : 0,
      totalQuantity: totalQty,
      loadedQuantity: loadedQty,
      remainingQuantity: money(totalQty - loadedQty),
      nextDestination: null,
      destinationType: ["warehouse", "export", "re-export", "local-sale"].includes(finalStage) ? finalStage : null,
      stageEvents: [
        {
          stage: finalStage,
          action: finalStage === "remaining" ? "load" : (finalStage === "land" ? "land" : "forward"),
          destination: finalStage === "remaining" ? null : finalStage,
          userId: actorId,
          at: `${day}T11:${pad2(orderIndex % 60)}:00.000Z`,
          note: sourceTag
        }
      ]
    };

    if (existing[0]) {
      await tx`
        update purchase_loading_records
        set
          purchase_order_id = ${order.id},
          country_id = ${branch.countryId},
          country_branch_id = ${branch.countryBranchId ?? null},
          city_branch_id = ${branch.cityBranchId ?? null},
          purchase_order_no = ${order.purchaseOrderNo},
          container_number = ${`${sourceTag}-CONT-${day.replace(/-/g, "")}-${pad2(orderIndex + 1)}`},
          container_type = ${finalStage === "remaining" ? "Partial" : "Full"},
          loading_status = ${finalStage === "remaining" ? "loaded" : "received"},
          loaded_at = ${day}::date + interval '12 hours',
          loading_location = ${branch.branchLabel},
          receiving_location = ${finalStage === "remaining" ? "Loading Yard" : `${finalStage} Stock`},
          shipment_status = ${finalStage},
          carrier_name = ${`${branch.branchLabel} Carrier`},
          remarks = ${sourceTag},
          report_payload = ${JSON.stringify(payload)}::jsonb,
          created_by = ${actorId},
          updated_at = ${day}::date + interval '12 hours'
        where id = ${existing[0].id}
      `;
      batchCounters.skippedLoadingRecords += 1;
      return existing[0].id;
    }

    await tx`
      insert into purchase_loading_records (
        country_id, country_branch_id, city_branch_id, purchase_order_id, loading_record_no,
        purchase_order_no, container_number, container_type, loading_status, loaded_at,
        loading_location, receiving_location, shipment_status, carrier_name, remarks, report_payload,
        created_by, created_at, updated_at
      ) values (
        ${branch.countryId},
        ${branch.countryBranchId ?? null},
        ${branch.cityBranchId ?? null},
        ${order.id},
        ${loadingNo},
        ${order.purchaseOrderNo},
        ${`${sourceTag}-CONT-${day.replace(/-/g, "")}-${pad2(orderIndex + 1)}`},
        ${finalStage === "remaining" ? "Partial" : "Full"},
        ${finalStage === "remaining" ? "loaded" : "received"},
        ${day}::date + interval '12 hours',
        ${branch.branchLabel},
        ${finalStage === "remaining" ? "Loading Yard" : `${finalStage} Stock`},
        ${finalStage},
        ${`${branch.branchLabel} Carrier`},
        ${sourceTag},
        ${JSON.stringify(payload)}::jsonb,
        ${actorId},
        ${day}::date + interval '12 hours',
        ${day}::date + interval '12 hours'
      )
    `;
    batchCounters.loadingRecords += 1;
    return loadingNo;
  }

  async function postCashRoznamcha(tx, branch, day, dayIndex, entryIndex, actorId) {
    const referenceNo = buildCashReference(sourceTag, day, `${dayIndex + 1}${entryIndex + 1}`);
    const existing = await tx`
      select id
      from roznamcha_entries
      where deleted_at is null
        and reference_no = ${referenceNo}
      limit 1
    `;
    if (existing[0]) {
      batchCounters.skippedCashEntries += 1;
      return existing[0].id;
    }

    const planIndex = (dayIndex + entryIndex) % 4;
    const cashLedger = ledgerPlans.find((row) => row.branch.branchCode === branch.branchCode)?.cashLedger;
    const bankLedger = ledgerPlans.find((row) => row.branch.branchCode === branch.branchCode)?.bankLedger;
    const receivableLedger = ledgerPlans.find((row) => row.branch.branchCode === branch.branchCode)?.receivableLedger;
    const payableLedger = ledgerPlans.find((row) => row.branch.branchCode === branch.branchCode)?.payableLedger;
    const amount = 500 + (planIndex * 125) + (entryIndex % 5) * 25;
    const useCash = planIndex % 2 === 0;
    const debitLedger = useCash ? cashLedger : bankLedger || cashLedger;
    const creditLedger = useCash ? (receivableLedger || payableLedger || bankLedger || cashLedger) : (payableLedger || receivableLedger || cashLedger);
    const narration = `${sourceTag} cash activity ${day} ${pad2(entryIndex + 1)} for ${branch.branchLabel}`;
    const journalNo = buildJournalNo(sourceTag, day, `${dayIndex + 1}${entryIndex + 1}`);
    const voucherNo = buildVoucherNo(sourceTag, day, `${dayIndex + 1}${entryIndex + 1}`);

    const rows = await tx`
      select set_config(
        'request.jwt.claims',
        json_build_object('sub', ${actorId}::text, 'role', 'authenticated')::text,
        true
      )
    `;
    void rows;

    const entryId = await tx`
      select post_roznamcha_entry(
        'branch'::roznamcha_type,
        ${branch.countryId},
        ${branch.countryBranchId ?? null},
        ${branch.cityBranchId ?? null},
        ${journalNo},
        ${voucherNo},
        ${day}::date,
        null,
        ${referenceNo},
        ${narration},
        ${tx.json([
          {
            paymentEntryType: "debit",
            ledgerId: debitLedger.id,
            description: narration,
            debit: amount,
            credit: 0,
            currency: branch.currency,
            exchangeRate: 1
          },
          {
            paymentEntryType: "credit",
            ledgerId: creditLedger.id,
            description: narration,
            debit: 0,
            credit: amount,
            currency: branch.currency,
            exchangeRate: 1
          }
        ])},
        true
      ) as entry_id
    `;
    batchCounters.cashEntries += 1;
    return entryId[0].entry_id;
  }

  if (args.dryRun) {
    console.log("Dry run complete. No writes performed.");
    console.log("Cleanup path:");
    console.log(`  scripts/cleanup-loadtest-activity.mjs --confirm-local-dev --source-tag ${sourceTag} --database-url <TARGET_DATABASE_URL>`);
    await sql.end({ timeout: 5 });
    return;
  }

  for (let dayIndex = 0; dayIndex < dateList.length; dayIndex += 1) {
    const day = dateList[dayIndex];
    await sql.begin(async (tx) => {
      const dayBranchSlice = selectedBranches.slice(0).sort((a, b) => a.orderBias - b.orderBias);
      for (const branch of dayBranchSlice) {
        await setActor(tx, branch.actor.id);
        await ensureDailyRate(tx, branch, day, dayIndex, branch.actor.id);
      }
    });

    for (let orderIndex = 0; orderIndex < args.purchasesPerDay; orderIndex += 1) {
      const branch = selectedBranches[(dayIndex * args.purchasesPerDay + orderIndex) % selectedBranches.length];
      const plan = ledgerPlans.find((row) => row.branch.branchCode === branch.branchCode);
      if (!plan) throw new Error(`Unable to resolve ledger plan for ${branch.branchLabel}.`);

      await sql.begin(async (tx) => {
        await setActor(tx, branch.actor.id);
        const order = await createPurchaseOrder(tx, branch, day, dayIndex, orderIndex, branch.actor.id);
        const scenario = (dayIndex + orderIndex) % 5;
        const purchaseCurrency = order.currencyCode;
        const fullAmount = money(order.orderTotal);
        const advance30 = money(fullAmount * 0.30);
        const advance50 = money(fullAmount * 0.50);
        const remaining70 = money(fullAmount - advance30);
        const remaining50 = money(fullAmount - advance50);
        const debitLedger = plan.purchaseLedger;
        const cashOrBankLedger = plan.cashLedger || plan.bankLedger || plan.payableLedger;
        const supplierLedger = plan.payableLedger || plan.cashLedger;

        if (scenario === 0) {
          // Keep as a visible outstanding booking.
        } else if (scenario === 1) {
          await postPurchasePayment(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, "advance", advance30, debitLedger, cashOrBankLedger, "ADV1");
          await postPurchasePayment(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, "remaining", remaining70, debitLedger, cashOrBankLedger, "REM1");
          await createOrMoveLoading(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, "warehouse");
        } else if (scenario === 2) {
          await postPurchasePayment(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, "advance", advance50, debitLedger, cashOrBankLedger, "ADV1");
          await createOrMoveLoading(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, "remaining");
        } else if (scenario === 3) {
          await postPurchasePayment(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, "credit", fullAmount, debitLedger, supplierLedger, "CR1");
          await createOrMoveLoading(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, "land");
          await createOrMoveLoading(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, ["warehouse", "export", "re-export", "local-sale"][(dayIndex + orderIndex) % 4]);
        } else {
          await postPurchasePayment(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, "advance", advance50, debitLedger, cashOrBankLedger, "ADV1");
          await postPurchasePayment(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, "remaining", remaining50, debitLedger, cashOrBankLedger, "REM1");
          await createOrMoveLoading(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, "land");
          await createOrMoveLoading(tx, branch, order, day, dayIndex, orderIndex, branch.actor.id, ["warehouse", "export", "re-export", "local-sale"][(dayIndex + orderIndex + 1) % 4]);
        }
      });

      purchaseCountByDay.set(day, (purchaseCountByDay.get(day) ?? 0) + 1);
      const branchKey = selectedBranches[(dayIndex * args.purchasesPerDay + orderIndex) % selectedBranches.length].branchLabel;
      perBranchCounts.set(branchKey, (perBranchCounts.get(branchKey) ?? 0) + 1);
    }

    for (let cashIndex = 0; cashIndex < args.cashPerDay; cashIndex += 1) {
      const branch = selectedBranches[(dayIndex * args.cashPerDay + cashIndex) % selectedBranches.length];
      await sql.begin(async (tx) => {
        await postCashRoznamcha(tx, branch, day, dayIndex, cashIndex, branch.actor.id);
      });
      cashCountByDay.set(day, (cashCountByDay.get(day) ?? 0) + 1);
    }

    // One rate row per country/day per batch day keeps historical FX data visible.
    // The branch loop above ensures branch-specific data is still tied to the same date.
  }

  const totals = await sql`
    select
      (select count(*) from purchase_orders where deleted_at is null and coalesce(form_data->>'seedTag', '') = ${sourceTag}) as orders,
      (select count(*) from purchase_order_items poi join purchase_orders po on po.id = poi.purchase_order_id where po.deleted_at is null and coalesce(po.form_data->>'seedTag', '') = ${sourceTag}) as items,
      (select count(*) from purchase_order_payments pop join purchase_orders po on po.id = pop.purchase_order_id where pop.deleted_at is null and coalesce(po.form_data->>'seedTag', '') = ${sourceTag}) as payments,
      (select count(*) from purchase_loading_records where deleted_at is null and coalesce(report_payload->>'seedTag', '') = ${sourceTag}) as loading_records,
      (select count(*) from daily_usd_rates where deleted_at is null and entered_by is not null and rate_date between ${args.startDate}::date and ${args.endDate}::date and country_id = any(${countryIds})) as rates,
      (select count(*) from roznamcha_entries where deleted_at is null and coalesce(reference_no, '') like ${`${sourceTag}%`}) as roznamcha_entries,
      (select coalesce(sum(debit), 0) from roznamcha_lines rl join roznamcha_entries re on re.id = rl.roznamcha_entry_id where re.deleted_at is null and coalesce(re.reference_no, '') like ${`${sourceTag}%`}) as debit_total,
      (select coalesce(sum(credit), 0) from roznamcha_lines rl join roznamcha_entries re on re.id = rl.roznamcha_entry_id where re.deleted_at is null and coalesce(re.reference_no, '') like ${`${sourceTag}%`}) as credit_total
  `;

  console.log("=======================================================================");
  console.log("  BULK LOAD SUMMARY");
  console.log("=======================================================================");
  console.table([{
    sourceTag,
    purchaseOrders: totals[0]?.orders ?? 0,
    purchaseItems: totals[0]?.items ?? 0,
    purchasePayments: totals[0]?.payments ?? 0,
    loadingRecords: totals[0]?.loading_records ?? 0,
    dailyRates: totals[0]?.rates ?? 0,
    roznamchaEntries: totals[0]?.roznamcha_entries ?? 0,
    debitTotal: totals[0]?.debit_total ?? 0,
    creditTotal: totals[0]?.credit_total ?? 0,
    difference: money((totals[0]?.debit_total ?? 0) - (totals[0]?.credit_total ?? 0))
  }]);

  console.log("Date-wise counts:");
  console.table(dateList.map((day) => ({
    day,
    purchases: purchaseCountByDay.get(day) ?? 0,
    cashEntries: cashCountByDay.get(day) ?? 0
  })));

  console.log("Branch-wise counts:");
  console.table([...perBranchCounts.entries()].map(([branch, count]) => ({ branch, count })));

  console.log("Cleanup path:");
  console.log(`  scripts/cleanup-loadtest-activity.mjs --confirm-local-dev --source-tag ${sourceTag} --database-url <TARGET_DATABASE_URL>`);
  console.log("Notes:");
  console.log("  • The script uses canonical purchase_orders, purchase_order_items, purchase_order_payments, daily_usd_rates, purchase_loading_records, and Roznamcha RPCs.");
  console.log("  • EPS execution is supported via --environment=EPS --database-url=... --expected-ref=... when the exact EPS connection is available.");
  await sql.end({ timeout: 10 });
}

main().catch(async (err) => {
  console.error("[LOADTEST] Failed:", err?.message || err);
  if (err?.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
});
