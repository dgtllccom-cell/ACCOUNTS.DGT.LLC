import postgres from "postgres";

const PROD_URL = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const SOURCE_TAG = "PROD-SANA-TEST";
const DAYS = ["2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08"];
const TARGET_BRANCH_IDS = [
  "89ce1041-80b0-4928-b7ea-d4a53bd79d15", // Al Ras
  "ad8c5172-3381-428d-9244-56487da263a9", // UAE Main Branch
  "adf14819-b4cf-4956-8fa6-51898f09e01f", // Afghanistan Main Branch
  "89ce1041-80b0-4928-b7ea-d4a53bd79d15", // repeat a safe scope for the 4th bill
];

function money(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function buildPurchaseOrderNo(day, index) {
  return `${SOURCE_TAG}-PO-${day.replace(/-/g, "")}-${pad2(index + 1)}`;
}

function buildContractNo(day, index) {
  return `${SOURCE_TAG}-CON-${day.replace(/-/g, "")}-${pad2(index + 1)}`;
}

function dailyRateFor(currencyCode, dayIndex) {
  const code = String(currencyCode || "USD").toUpperCase();
  const shift = (dayIndex % 4) * 0.01;
  if (code === "AED") return 3.65 + shift;
  if (code === "PKR") return 278.5 + shift * 10;
  if (code === "AFN") return 71 + shift * 5;
  if (code === "INR") return 83.4 + shift * 3;
  return 1 + shift;
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
  const rate1 = currencyCode === "USD" ? 9 + (orderIndex % 4) * 0.5 : 32 + (orderIndex % 4) * 6;
  const rate2 = currencyCode === "USD" ? 6.75 + (orderIndex % 4) * 0.25 : 24 + (orderIndex % 4) * 4;
  return [
    {
      goods_name: `${base.goods} - SANA TEST`,
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
      rate_usd: currencyCode === "USD" ? rate1 : money(rate1 / 3.65),
      total_original: money(quantities[0] * rate1),
      total_local: money(quantities[0] * rate1),
      total_usd: currencyCode === "USD" ? money(quantities[0] * rate1) : money((quantities[0] * rate1) / 3.65),
    },
    {
      goods_name: `${second.goods} - SANA TEST`,
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
      rate_usd: currencyCode === "USD" ? rate2 : money(rate2 / 3.65),
      total_original: money(quantities[1] * rate2),
      total_local: money(quantities[1] * rate2),
      total_usd: currencyCode === "USD" ? money(quantities[1] * rate2) : money((quantities[1] * rate2) / 3.65),
    }
  ];
}

async function main() {
  if (!process.argv.includes("--confirm-production")) {
    throw new Error("Missing --confirm-production.");
  }
  const sql = postgres(PROD_URL, {
    ssl: { rejectUnauthorized: false },
    max: 2,
    prepare: false,
  });

  try {
    const [actor] = await sql`
      select id, coalesce(full_name, user_code, id::text) as label
      from profiles
      where deleted_at is null
      order by created_at asc
      limit 1
    `;
    if (!actor?.id) throw new Error("No active profile found for actor.");

    const cityBranches = await sql`
      select
        cb.id as branch_id,
        cb.country_id,
        c.id as country_id_resolved,
        c.name as country_name,
        cb.name as branch_name,
        cb.code as branch_code,
        'city'::text as branch_kind
      from city_branches cb
      join countries c on c.id = cb.country_id
      where cb.deleted_at is null
        and cb.id = any(${TARGET_BRANCH_IDS}::uuid[])
    `;
    const countryBranches = await sql`
      select
        cb.id as branch_id,
        cb.country_id,
        c.id as country_id_resolved,
        c.name as country_name,
        cb.name as branch_name,
        cb.code as branch_code,
        'country'::text as branch_kind
      from country_branches cb
      join countries c on c.id = cb.country_id
      where cb.deleted_at is null
        and cb.id = any(${TARGET_BRANCH_IDS}::uuid[])
    `;
    const branches = [...cityBranches, ...countryBranches];
    if (branches.length < 3) throw new Error("Need at least 3 target branches for the Sana batch.");

    const branchById = new Map(branches.map((row) => [String(row.branch_id), row]));

    const companies = await sql`
      select id, name, country_id
      from companies
      where deleted_at is null and is_active = true
      order by created_at asc
      limit 50
    `;
    const goods = await sql`
      select id, goods_name, chs_code, origin_country_id
      from goods
      where deleted_at is null and is_active = true
      order by created_at asc
      limit 50
    `;
    const ledgers = await sql`
      select id, code, name, account_id, country_id, country_branch_id, city_branch_id
      from ledgers
      where deleted_at is null and is_active = true
      order by created_at asc
    `;

    function pickLedger(branch, patterns, fallbackPatterns = []) {
      const branchScoped = ledgers.filter((row) => {
        return (
          String(row.country_branch_id || "") === String(branch.branch_id || "") ||
          String(row.country_id || "") === String(branch.country_id_resolved || "") ||
          !row.country_id
        );
      });
      const match = (list) => branchScoped.find((row) => list.some((pattern) => pattern.test(`${row.code || ""} ${row.name || ""}`)));
      return match(patterns) || match(fallbackPatterns) || branchScoped[0] || ledgers[0] || null;
    }

    const created = [];

    for (let index = 0; index < DAYS.length; index += 1) {
      const day = DAYS[index];
      const branch = branchById.get(TARGET_BRANCH_IDS[index]);
      const currencyCode = index % 2 === 0 ? "USD" : (branch.country_name.toUpperCase().includes("UNITED ARAB EMIRATES") ? "AED" : "USD");
      const exchangeRate = dailyRateFor(currencyCode, index);
      const supplier = companies.find((company) => String(company.country_id || "") === String(branch.country_id_resolved || "")) || companies[index % companies.length];
      const goodsRow = goods.find((row) => String(row.origin_country_id || "") === String(branch.country_id_resolved || "")) || goods[index % goods.length];
      const purchaseLedger = pickLedger(branch, [/purchase/i, /inventory/i, /stock/i, /goods/i, /expense/i], [/payable/i, /supplier/i, /creditor/i]);
      const creditLedger = pickLedger(branch, [/payable/i, /supplier/i, /creditor/i], [/cash/i, /bank/i]);
      if (!purchaseLedger || !creditLedger) throw new Error(`Ledger resolution failed for ${branch.branch_name}.`);
      if (String(purchaseLedger.id) === String(creditLedger.id)) {
        throw new Error(`Resolved identical ledgers for ${branch.branch_name}; refusing to seed.`);
      }

      const items = buildOrderItems(index, 0, currencyCode, branch.branch_name);
      const orderTotal = money(items.reduce((sum, item) => sum + Number(item.total_original || 0), 0));
      const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const createdAt = `${day}T09:${pad2(index)}:00.000Z`;
      const purchaseNo = buildPurchaseOrderNo(day, index);
      const contractNo = buildContractNo(day, index);

      const existing = await sql`
        select id
        from purchase_orders
        where deleted_at is null and purchase_order_no = ${purchaseNo}
        limit 1
      `;
      if (existing[0]) {
        created.push({ day, purchaseNo, skipped: true });
        continue;
      }

      const orderId = await sql.begin(async (tx) => {
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
            ${branch.country_id_resolved},
            ${branch.branch_id},
            ${null},
            ${purchaseNo},
            ${contractNo},
            ${supplier?.id ?? null},
            ${currencyCode},
            ${currencyCode},
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
            ${JSON.stringify({
              seedTag: SOURCE_TAG,
              seedType: "SANA_PURCHASE",
              branchLabel: branch.branch_name,
              countryName: branch.country_name,
              goodsPreview: items.map((item) => item.goods_name),
            })}::jsonb,
            ${actor.id},
            ${createdAt},
            ${createdAt}
          )
          returning id
        `;
        const purchaseOrderId = inserted[0].id;

        for (const item of items) {
          await tx`
            insert into purchase_order_items (
              purchase_order_id, goods_name, hs_code, size, brand, origin,
              quantity, unit_name, unit_weight, gross_weight, net_weight,
              rate_original, rate_local, rate_usd, total_original, total_local, total_usd,
              created_at, updated_at
            ) values (
              ${purchaseOrderId},
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
        }

        const paymentId = await tx`
          select post_purchase_booking_transfer(
            ${actor.id},
            ${purchaseOrderId},
            'credit'::purchase_order_payment_kind,
            ${day}::date,
            ${orderTotal},
            ${currencyCode},
            ${exchangeRate},
            ${purchaseLedger.id},
            ${creditLedger.id},
            ${`${SOURCE_TAG}-PAY-${purchaseNo}`},
            ${`SANA purchase bill ${purchaseNo} - ${branch.branch_name}`}
          ) as payment_id
        `;
        if (!paymentId[0]?.payment_id) {
          throw new Error(`Payment posting failed for ${purchaseNo}.`);
        }
        return purchaseOrderId;
      });

      created.push({ day, purchaseNo, orderTotal, totalQuantity, currencyCode, exchangeRate, orderId });
    }

    console.log(JSON.stringify({ ok: true, sourceTag: SOURCE_TAG, created }, null, 2));
  } finally {
    await sql.end({ timeout: 10 });
  }
}

await main();
