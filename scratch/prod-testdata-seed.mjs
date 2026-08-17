import postgres from "postgres";

const PROD_URL =
  "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

const SOURCE_TAG = "PROD-TEST-20260817-R01";
const ACTOR_ID = "9b9d24d9-5532-47a1-b612-3e95f2285a86";

const UAE_COUNTRY_ID = "935dd0b9-8228-43b3-b53d-c06e9ae2882f";
const UAE_MAIN_BRANCH_ID = "ad8c5172-3381-428d-9244-56487da263a9";
const AL_RAS_CITY_BRANCH_ID = "89ce1041-80b0-4928-b7ea-d4a53bd79d15";

const DAYS = [
  "2026-08-05",
  "2026-08-06",
  "2026-08-07",
  "2026-08-08",
  "2026-08-09",
  "2026-08-10",
];

const STANDALONE_ROZ_COUNT = 500;
const LOCAL_PURCHASE_COUNT = 22;
const SANA_PURCHASE_COUNT = 4;

const STANDALONE_ROZ_BATCH = 50;

const ROZ_LEDGER_PAIRS = [
  { debit: "LOADTEST-AE-PURCHASE", credit: "LOADTEST-AE-PAYABLE" },
  { debit: "LOADTEST-AE-CASH", credit: "LOADTEST-AE-PURCHASE" },
  { debit: "LOADTEST-AE-BANK", credit: "LOADTEST-AE-PAYABLE" },
  { debit: "LOADTEST-AE-RECEIVABLE", credit: "LOADTEST-AE-CASH" },
  { debit: "LOADTEST-AE-PURCHASE", credit: "LOADTEST-AE-BANK" },
  { debit: "LOADTEST-AE-PAYABLE", credit: "LOADTEST-AE-RECEIVABLE" },
];

const LOCAL_PURCHASE_MODES = ["Cash", "Credit", "Advance", "Remaining"];

function money(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
}

function pad(value, size = 2) {
  return String(value).padStart(size, "0");
}

function serialSuffix(value) {
  const match = String(value ?? "").match(/([0-9]+)$/);
  return match ? Number(match[1]) : 0;
}

function sameText(a, b) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

async function setActor(tx) {
  await tx`
    select set_config(
      'request.jwt.claims',
      ${JSON.stringify({ sub: ACTOR_ID, role: "authenticated" })},
      true
    );
  `;
}

async function loadMasters(tx) {
  const [actor] = await tx`
    select id, full_name, user_code
    from profiles
    where deleted_at is null
      and id = ${ACTOR_ID}::uuid
    limit 1
  `;
  if (!actor?.id) {
    throw new Error("Production actor profile was not found.");
  }

  const branches = await tx`
    select
      cb.id as branch_id,
      cb.country_id,
      cb.country_branch_id,
      cb.city_branch_id,
      cb.name as branch_name,
      cb.code as branch_code,
      c.name as country_name,
      c.currency_code as country_currency_code
    from (
      select id, country_id, null::uuid as country_branch_id, id as city_branch_id, name, code
      from city_branches
      where deleted_at is null and id = ${AL_RAS_CITY_BRANCH_ID}::uuid
      union all
      select id, country_id, id as country_branch_id, null::uuid as city_branch_id, name, code
      from country_branches
      where deleted_at is null and id = ${UAE_MAIN_BRANCH_ID}::uuid
    ) cb
    join countries c on c.id = cb.country_id
  `;

  const companies = await tx`
    select id, name, country_id
    from companies
    where deleted_at is null and is_active = true
      and country_id = ${UAE_COUNTRY_ID}::uuid
    order by created_at asc
  `;

  const goods = await tx`
    select id, goods_name, chs_code, origin_country_id
    from goods
    where deleted_at is null and is_active = true
    order by created_at asc
  `;

  const ledgers = await tx`
    select id, code, name, account_id, country_id, country_branch_id, city_branch_id
    from ledgers
    where deleted_at is null and is_active = true
      and code = any(${[
        "LOADTEST-AE-BANK",
        "LOADTEST-AE-CASH",
        "LOADTEST-AE-PAYABLE",
        "LOADTEST-AE-PURCHASE",
        "LOADTEST-AE-RECEIVABLE",
      ]}::text[])
    order by code asc
  `;

  const ledgerByCode = new Map(ledgers.map((row) => [String(row.code), row]));
  const companyByIndex = companies.length ? companies : [];

  return {
    actor,
    branches: branches.map((row) => ({
      ...row,
      isCity: Boolean(row.city_branch_id),
      isMainBranch: Boolean(row.country_branch_id && !row.city_branch_id),
    })),
    companies: companyByIndex,
    goods,
    ledgerByCode,
  };
}

async function repairSerialCounters(tx) {
  const targets = [
    {
      scopeType: "global",
      scopeKey: "global",
      entityType: "roznamcha",
      prefix: "SA",
      nextValueSql: tx`
        select coalesce(max(serial_suffix), 0) + 1 as next_value
        from (
          select (regexp_match(super_admin_serial_number, '([0-9]+)$'))[1]::bigint as serial_suffix
          from roznamcha_entries
          where deleted_at is null
        ) x
      `,
    },
    {
      scopeType: "country",
      scopeKey: UAE_COUNTRY_ID,
      entityType: "roznamcha",
      prefix: "UAE",
      nextValueSql: tx`
        select coalesce(max(serial_suffix), 0) + 1 as next_value
        from (
          select (regexp_match(country_transaction_serial_number, '([0-9]+)$'))[1]::bigint as serial_suffix
          from roznamcha_entries
          where deleted_at is null
            and country_id = ${UAE_COUNTRY_ID}::uuid
        ) x
      `,
    },
    {
      scopeType: "branch",
      scopeKey: UAE_MAIN_BRANCH_ID,
      entityType: "roznamcha",
      prefix: "MAIN",
      nextValueSql: tx`
        select coalesce(max(serial_suffix), 0) + 1 as next_value
        from (
          select (regexp_match(branch_transaction_serial_number, '([0-9]+)$'))[1]::bigint as serial_suffix
          from roznamcha_entries
          where deleted_at is null
            and country_branch_id = ${UAE_MAIN_BRANCH_ID}::uuid
        ) x
      `,
    },
    {
      scopeType: "main_branch",
      scopeKey: UAE_MAIN_BRANCH_ID,
      entityType: "roznamcha",
      prefix: "MAIN",
      nextValueSql: tx`
        select coalesce(max(serial_suffix), 0) + 1 as next_value
        from (
          select (regexp_match(main_branch_transaction_serial, '([0-9]+)$'))[1]::bigint as serial_suffix
          from roznamcha_entries
          where deleted_at is null
            and country_branch_id = ${UAE_MAIN_BRANCH_ID}::uuid
        ) x
      `,
    },
  ];

  const before = [];
  const after = [];

  for (const target of targets) {
    const [current] = await tx`
      select scope_type, scope_key, entity_type, prefix, next_value
      from transaction_serial_sequences
      where scope_type = ${target.scopeType}
        and scope_key = ${target.scopeKey}
        and entity_type = ${target.entityType}
      limit 1
    `;
    before.push(current ?? {
      scope_type: target.scopeType,
      scope_key: target.scopeKey,
      entity_type: target.entityType,
      prefix: null,
      next_value: null,
    });

    const [computed] = await target.nextValueSql;
    const nextValue = Number(computed?.next_value ?? 1);
    await tx`
      insert into transaction_serial_sequences (
        scope_type, scope_key, entity_type, prefix, next_value
      )
      values (
        ${target.scopeType},
        ${target.scopeKey},
        ${target.entityType},
        ${target.prefix},
        ${nextValue}
      )
      on conflict (scope_type, scope_key, entity_type)
      do update set
        next_value = greatest(transaction_serial_sequences.next_value, excluded.next_value),
        updated_at = now();
    `;

    const [updated] = await tx`
      select scope_type, scope_key, entity_type, prefix, next_value
      from transaction_serial_sequences
      where scope_type = ${target.scopeType}
        and scope_key = ${target.scopeKey}
        and entity_type = ${target.entityType}
      limit 1
    `;
    after.push(updated);
  }

  return { before, after };
}

async function linkLocalPurchaseLedgers(tx) {
  const accountCodes = [
    "TEST-ACC-001",
    "ACC-QA-1547",
    "ACC-QA-4718",
    "ACC-QA-2277",
  ];
  const [purchaseAccount, payableAccount, cashAccount, bankAccount] = await tx`
    select id, code, name
    from accounts
    where deleted_at is null and is_active = true and code = any(${accountCodes}::text[])
    order by array_position(${accountCodes}::text[], code)
  `;
  const accounts = await tx`
    select id, code
    from accounts
    where deleted_at is null and is_active = true and code = any(${accountCodes}::text[])
    order by array_position(${accountCodes}::text[], code)
  `;
  const accountMap = new Map(accounts.map((row) => [String(row.code), row.id]));
  if (!accountMap.get("TEST-ACC-001") || !accountMap.get("ACC-QA-1547") || !accountMap.get("ACC-QA-4718") || !accountMap.get("ACC-QA-2277")) {
    throw new Error("Required test accounts are missing for local purchase ledger linking.");
  }

  const targetLedgers = [
    ["LOADTEST-AE-PURCHASE", accountMap.get("TEST-ACC-001")],
    ["LOADTEST-AE-PAYABLE", accountMap.get("ACC-QA-1547")],
    ["LOADTEST-AE-CASH", accountMap.get("ACC-QA-4718")],
    ["LOADTEST-AE-BANK", accountMap.get("ACC-QA-2277")],
  ];

  for (const [ledgerCode, accountId] of targetLedgers) {
    await tx`
      update ledgers
      set account_id = ${accountId}::uuid,
          updated_at = now()
      where code = ${ledgerCode}
        and deleted_at is null
        and is_active = true
    `;
  }

  const refreshed = await tx`
    select id, code, name, account_id, country_id, country_branch_id, city_branch_id
    from ledgers
    where code = any(${[
      "LOADTEST-AE-BANK",
      "LOADTEST-AE-CASH",
      "LOADTEST-AE-PAYABLE",
      "LOADTEST-AE-PURCHASE",
      "LOADTEST-AE-RECEIVABLE",
    ]}::text[])
      and deleted_at is null
      and is_active = true
  `;

  return refreshed;
}

function branchForIndex(branches, index) {
  return branches[index % branches.length];
}

function rozScope(entryIndex, branches) {
  return branchForIndex(branches, entryIndex % branches.length);
}

function ruzRef(index) {
  return `${SOURCE_TAG}-RZ-${pad(index + 1, 4)}`;
}

function purchaseNo(index, day) {
  return `${SOURCE_TAG}-PO-${day.replace(/-/g, "")}-${pad(index + 1, 2)}`;
}

function contractNo(index, day) {
  return `${SOURCE_TAG}-CON-${day.replace(/-/g, "")}-${pad(index + 1, 2)}`;
}

function localBillNo(index, day) {
  return `${SOURCE_TAG}-LP-${day.replace(/-/g, "")}-${pad(index + 1, 2)}`;
}

function journalNo(index, day) {
  return `${SOURCE_TAG}-JV-${day.replace(/-/g, "")}-${pad(index + 1, 2)}`;
}

function voucherNo(index, day) {
  return `${SOURCE_TAG}-VV-${day.replace(/-/g, "")}-${pad(index + 1, 2)}`;
}

async function createStandaloneRoznamchaBatch(tx, batchStart, batchSize, masters) {
  await setActor(tx);
  const created = [];
  for (let i = 0; i < batchSize; i += 1) {
    const absoluteIndex = batchStart + i;
    const day = DAYS[absoluteIndex % DAYS.length];
    const branch = rozScope(absoluteIndex, masters.branches);
    const pair = ROZ_LEDGER_PAIRS[absoluteIndex % ROZ_LEDGER_PAIRS.length];
    const debitLedger = masters.ledgerByCode.get(pair.debit);
    const creditLedger = masters.ledgerByCode.get(pair.credit);
    if (!debitLedger || !creditLedger) {
      throw new Error(`Missing loadtest ledgers for roznamcha row ${absoluteIndex + 1}.`);
    }
    if (String(debitLedger.id) === String(creditLedger.id)) {
      throw new Error(`Degenerate ledger pair for row ${absoluteIndex + 1}.`);
    }

    const amount = money(1000 + absoluteIndex * 11.25);
    const ref = ruzRef(absoluteIndex);
    const existing = await tx`
      select id
      from roznamcha_entries
      where deleted_at is null
        and (reference_no = ${ref} or source_reference_no = ${ref})
      limit 1
    `;
    if (existing[0]) {
      created.push({ reference_no: ref, skipped: true, day, branch: branch.branch_name });
      continue;
    }
    const lines = [
      {
        paymentEntryType: "debit",
        ledgerId: debitLedger.id,
        description: `PROD TEST DR ${debitLedger.code}`,
        debit: amount,
        credit: 0,
        currency: "AED",
        usdRate: 1,
      },
      {
        paymentEntryType: "credit",
        ledgerId: creditLedger.id,
        description: `PROD TEST CR ${creditLedger.code}`,
        debit: 0,
        credit: amount,
        currency: "AED",
        usdRate: 1,
      },
    ];

    const [entry] = await tx`
      select post_roznamcha_entry(
        ${branch.isCity ? "branch" : "branch"}::roznamcha_type,
        ${UAE_COUNTRY_ID}::uuid,
        ${UAE_MAIN_BRANCH_ID}::uuid,
        ${branch.city_branch_id ?? null}::uuid,
        ${journalNo(absoluteIndex, day)},
        ${voucherNo(absoluteIndex, day)},
        ${day}::date,
        ${null},
        ${ref},
        ${`PROD TEST Roznamcha ${ref}`},
        ${tx.json(lines)},
        true
      ) as id
    `;

    if (!entry?.id) {
      throw new Error(`post_roznamcha_entry returned no id for ${ref}.`);
    }

    await tx`
      update roznamcha_entries
      set source_module = ${SOURCE_TAG},
          source_transaction_type = 'standalone_roznamcha',
          source_transaction_id = null,
          source_reference_no = ${ref},
          entry_category = 'business',
          updated_at = now()
      where id = ${entry.id}::uuid;
    `;

    created.push({
      reference_no: ref,
      entry_id: entry.id,
      amount,
      day,
      branch: branch.branch_name,
      debit_ledger: debitLedger.code,
      credit_ledger: creditLedger.code,
    });
  }
  return created;
}

async function createSanaPurchase(tx, index, masters) {
  await setActor(tx);
  const day = DAYS[index % DAYS.length];
  const branch = branchForIndex(masters.branches, index % masters.branches.length);
  const company = masters.companies[index % masters.companies.length];
  const currencyCode = "AED";
  const exchangeRate = 1;
  const purchaseLedger = masters.ledgerByCode.get("LOADTEST-AE-PURCHASE");
  const creditLedger = masters.ledgerByCode.get("LOADTEST-AE-PAYABLE");
  if (!purchaseLedger || !creditLedger) {
    throw new Error("Missing Sana billing ledgers.");
  }

  const orderNo = purchaseNo(index, day);
  const contract = contractNo(index, day);
  const existing = await tx`
    select id
    from purchase_orders
    where deleted_at is null
      and purchase_order_no = ${orderNo}
    limit 1
  `;
  if (existing[0]) {
    return { skipped: true, purchase_order_no: orderNo };
  }

  const items = [
    {
      goods_name: `SANA TEST ALMOND ${index + 1}`,
      hs_code: "080212",
      size: `W${(320 + (index % 4) * 10).toString()}`,
      brand: "Digital DGT LLC",
      origin: branch.branch_name,
      quantity: 10,
      unit_name: "carton",
      unit_weight: 10,
      gross_weight: 100,
      net_weight: 98,
      rate_original: money(45 + index * 2),
      rate_local: money(45 + index * 2),
      rate_usd: money(45 + index * 2),
    },
    {
      goods_name: `SANA TEST WALNUT ${index + 1}`,
      hs_code: "080232",
      size: `S${(20 + (index % 3) * 5).toString()}`,
      brand: "Digital DGT LLC",
      origin: branch.branch_name,
      quantity: 5,
      unit_name: "carton",
      unit_weight: 10,
      gross_weight: 50,
      net_weight: 49,
      rate_original: money(32 + index * 1.5),
      rate_local: money(32 + index * 1.5),
      rate_usd: money(32 + index * 1.5),
    },
  ];
  const orderTotal = money(items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.rate_original), 0));

  const [inserted] = await tx`
    insert into purchase_orders (
      country_id,
      country_branch_id,
      city_branch_id,
      purchase_order_no,
      purchase_contract_no,
      supplier_company_id,
      currency_code,
      exchange_rate,
      order_total,
      advance_paid,
      remaining_paid,
      credit_amount,
      remaining_due,
      payment_status,
      ledger_posting_status,
      purchase_currency,
      payment_currency,
      total_goods_original,
      total_goods_local,
      total_goods_usd,
      total_expenses_original,
      total_expenses_local,
      total_expenses_usd,
      landed_cost_original,
      landed_cost_local,
      landed_cost_usd,
      status,
      form_data,
      created_by,
      created_at,
      updated_at
    ) values (
      ${UAE_COUNTRY_ID}::uuid,
      ${UAE_MAIN_BRANCH_ID}::uuid,
      ${branch.city_branch_id ?? null}::uuid,
      ${orderNo},
      ${contract},
      ${company.id}::uuid,
      ${currencyCode},
      ${exchangeRate},
      ${orderTotal},
      0,
      0,
      0,
      ${orderTotal},
      'pending',
      'draft',
      ${currencyCode},
      ${currencyCode},
      ${orderTotal},
      ${orderTotal},
      ${orderTotal},
      0,
      0,
      0,
      ${orderTotal},
      ${orderTotal},
      ${orderTotal},
      'Draft',
      ${tx.json({
        seedTag: SOURCE_TAG,
        seedType: "SANA_PURCHASE",
        branch: branch.branch_name,
        company: company.name,
        items: items.map((item) => item.goods_name),
      })},
      ${ACTOR_ID}::uuid,
      ${day}::timestamp with time zone,
      ${day}::timestamp with time zone
    )
    returning id
  `;

  for (const [itemIndex, item] of items.entries()) {
    await tx`
      insert into purchase_order_items (
        purchase_order_id,
        goods_name,
        hs_code,
        size,
        brand,
        origin,
        quantity,
        unit_name,
        unit_weight,
        gross_weight,
        net_weight,
        rate_original,
        rate_local,
        rate_usd,
        total_original,
        total_local,
        total_usd,
        created_at,
        updated_at
      ) values (
        ${inserted.id}::uuid,
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
        ${money(item.quantity * item.rate_original)},
        ${money(item.quantity * item.rate_original)},
        ${money(item.quantity * item.rate_original)},
        ${day}::timestamp with time zone,
        ${day}::timestamp with time zone
      )
    `;
  }

  const [payment] = await tx`
    select post_purchase_booking_transfer(
      ${ACTOR_ID}::uuid,
      ${inserted.id}::uuid,
      'credit'::purchase_order_payment_kind,
      ${day}::date,
      ${orderTotal},
      ${currencyCode},
      ${exchangeRate},
      ${purchaseLedger.id}::uuid,
      ${creditLedger.id}::uuid,
      ${`${SOURCE_TAG}-PAY-${orderNo}`},
      ${`SANA purchase bill ${orderNo} - ${branch.branch_name}`}
    ) as payment_id
  `;

  if (!payment?.payment_id) {
    throw new Error(`Sana purchase transfer failed for ${orderNo}.`);
  }

  return {
    purchase_order_id: inserted.id,
    purchase_order_no: orderNo,
    payment_id: payment.payment_id,
    branch: branch.branch_name,
    company: company.name,
    amount: orderTotal,
  };
}

async function createLocalPurchase(tx, index, masters) {
  await setActor(tx);
  const day = DAYS[index % DAYS.length];
  const branch = branchForIndex(masters.branches, index % masters.branches.length);
  const company = masters.companies[(index + 3) % masters.companies.length];
  const goods = masters.goods[(index + 2) % masters.goods.length];
  const purchaseLedger = masters.ledgerByCode.get("LOADTEST-AE-PURCHASE");
  const cashLedger = masters.ledgerByCode.get("LOADTEST-AE-CASH");
  const payableLedger = masters.ledgerByCode.get("LOADTEST-AE-PAYABLE");
  const bankLedger = masters.ledgerByCode.get("LOADTEST-AE-BANK");
  if (!purchaseLedger || !cashLedger || !payableLedger || !bankLedger) {
    throw new Error("Missing local purchase ledgers.");
  }

  const mode = LOCAL_PURCHASE_MODES[index % LOCAL_PURCHASE_MODES.length];
  const amount = money(750 + index * 37.5);
  const purchaseRate = money(25 + (index % 5) * 3.5);
  const qtyKgs = money(amount / purchaseRate);
  const manualBillNo = localBillNo(index, day);
  const journalNoValue = journalNo(index, day);
  const journalEntryNo = `JV-${journalNoValue}`;
  const sourceRef = `${SOURCE_TAG}-LP-${pad(index + 1, 3)}`;
  const existing = await tx`
    select id
    from local_purchases
    where deleted_at is null
      and manual_bill_no = ${manualBillNo}
    limit 1
  `;
  if (existing[0]) {
    return { skipped: true, manual_bill_no: manualBillNo };
  }

  const creditLedger =
    mode === "Cash" ? cashLedger :
    mode === "Advance" ? bankLedger :
    mode === "Remaining" ? payableLedger :
    payableLedger;
  const companyId = company?.id ?? null;
  const goodsId = goods?.id ?? null;
  const branchId = branch?.city_branch_id ?? UAE_MAIN_BRANCH_ID;
  const purchaseLedgerAccountId = purchaseLedger?.account_id ?? null;
  const creditLedgerAccountId = creditLedger?.account_id ?? null;
  if (!companyId || !goodsId || !purchaseLedgerAccountId || !creditLedgerAccountId) {
    throw new Error(`Missing master data for local purchase row ${index + 1}.`);
  }

  const createdAt = `${day}T10:${pad(index % 60)}:00.000Z`;
  const [insertLocal] = await tx`
    insert into local_purchases (
      company_id,
      country_id,
      country_branch_id,
      city_branch_id,
      goods_id,
      goods_name,
      supplier_name,
      quantity_name,
      quantity_kgs,
      total_gross_weight,
      empty_kgs,
      net_weight,
      divide_kgs,
      numbers,
      rate_type,
      purchase_rate,
      purchase_currency,
      exchange_rate,
      local_currency,
      purchase_cost,
      final_cost,
      created_by,
      created_at,
      updated_at,
      purchase_account_no,
      sales_account_no,
      brand,
      size,
      chassis_code,
      payment_mode,
      shipping_mode,
      origin_country_id,
      origin_country_name,
      broker_account_no,
      advance_percentage,
      advance_amount,
      remaining_balance,
      warehouse_name,
      warehouse_plot_no,
      transfer_date,
      truck_no,
      driver_name,
      lot_no,
      apply_tax,
      tax_type,
      tax_percentage,
      tax_amount,
      status,
      manual_bill_no,
      journal_serial_no,
      country_serial_no,
      branch_serial_no,
      accepted_at,
      accepted_by,
      transferred_at
    ) values (
      ${companyId}::uuid,
      ${UAE_COUNTRY_ID}::uuid,
      ${UAE_MAIN_BRANCH_ID}::uuid,
      ${branch.city_branch_id ?? null}::uuid,
      ${goodsId}::uuid,
      ${goods.goods_name},
      ${company.name},
      'Bags',
      ${qtyKgs},
      ${qtyKgs + 5},
      5,
      ${qtyKgs},
      0,
      ${10 + index},
      'per_kg',
      ${purchaseRate},
      'AED',
      1,
      'AED',
      ${amount},
      ${amount},
      ${ACTOR_ID}::uuid,
      ${createdAt}::timestamp with time zone,
      ${createdAt}::timestamp with time zone,
      ${purchaseLedger.code},
      ${creditLedger.code},
      ${`Digital DGT LLC ${goods.goods_name}`},
      ${`S${10 + (index % 7)}`},
      ${`CH-${SOURCE_TAG}-${pad(index + 1, 3)}`},
      ${mode},
      ${index % 2 === 0 ? "Sea" : "Truck"},
      ${UAE_COUNTRY_ID}::uuid,
      ${"United Arab Emirates"},
      ${creditLedger.code},
      ${mode === "Advance" ? 30 : 0},
      ${mode === "Advance" ? money(amount * 0.3) : 0},
      ${mode === "Remaining" ? money(amount * 0.4) : 0},
      ${`Warehouse-${branch.branch_name}`},
      ${`PLOT-${pad(index + 1, 3)}`},
      ${day},
      ${`TRK-${pad(index + 1, 4)}`},
      ${`Driver ${index + 1}`},
      ${`LOT-${SOURCE_TAG}-${pad(index + 1, 3)}`},
      'No',
      'VAT',
      0,
      0,
      'draft',
      ${manualBillNo},
      ${journalEntryNo},
      null,
      null,
      null,
      ${ACTOR_ID}::uuid,
      null
    )
    returning id
  `;

  const journalEntryNoFull = journalEntryNo;
  if (index === 0) {
    console.log("LOCAL_PURCHASE_DEBUG", JSON.stringify({
      companyId,
      branchId,
      journalEntryNoFull,
      insertLocalId: insertLocal.id,
      purchaseLedgerAccountId,
      creditLedgerAccountId,
      goodsId,
    }, null, 2));
  }
  const [journalInsert] = await tx`
    insert into journal_entries (
      company_id,
      branch_id,
      entry_no,
      entry_date,
      status,
      memo,
      source_type,
      source_id,
      posted_at,
      posted_by,
      created_at,
      updated_at
    ) values (
      ${companyId}::uuid,
      ${null},
      ${journalEntryNoFull},
      ${day}::date,
      'draft',
      ${`PROD TEST Local Purchase ${manualBillNo}`},
      'local_purchase',
      ${insertLocal.id}::uuid,
      null,
      null,
      ${createdAt}::timestamp with time zone,
      ${createdAt}::timestamp with time zone
    )
    returning id, entry_no
  `;

  const journalLines = [
    {
      account_id: purchaseLedger.account_id,
      description: `DR Local Purchase ${goods.goods_name}`,
      debit: amount,
      credit: 0,
    },
    {
      account_id: creditLedger.account_id,
      description: `CR Local Purchase ${company.name} ${mode}`,
      debit: 0,
      credit: amount,
    },
  ];

  for (const line of journalLines) {
    await tx`
      insert into journal_lines (
        journal_entry_id,
        account_id,
        description,
        debit,
        credit
      ) values (
        ${journalInsert.id}::uuid,
        ${line.account_id}::uuid,
        ${line.description},
        ${line.debit},
        ${line.credit}
      )
    `;
  }

  await tx`select post_journal_entry(${journalInsert.id}::uuid);`;

  const rozLines = [
    {
      paymentEntryType: "debit",
      ledgerId: purchaseLedger.id,
      description: `DR Local Purchase ${goods.goods_name}`,
      debit: amount,
      credit: 0,
      currency: "AED",
      usdRate: 1,
    },
    {
      paymentEntryType: "credit",
      ledgerId: creditLedger.id,
      description: `CR Local Purchase ${company.name} ${mode}`,
      debit: 0,
      credit: amount,
      currency: "AED",
      usdRate: 1,
    },
  ];

  const [roz] = await tx`
    select post_roznamcha_entry(
      ${branch.isCity ? "branch" : "branch"}::roznamcha_type,
      ${UAE_COUNTRY_ID}::uuid,
      ${UAE_MAIN_BRANCH_ID}::uuid,
      ${branch.city_branch_id ?? null}::uuid,
      ${journalEntryNoFull},
      ${`LPV-${SOURCE_TAG}-${pad(index + 1, 3)}`},
      ${day}::date,
      ${null},
      ${sourceRef},
      ${`PROD TEST Local Purchase ${manualBillNo}`},
      ${tx.json(rozLines)},
      true
    ) as id
  `;

  if (!roz?.id) {
    throw new Error(`Local purchase Roznamcha failed for ${manualBillNo}.`);
  }

  await tx`
    update roznamcha_entries
    set source_module = ${SOURCE_TAG},
        source_transaction_type = 'local_purchase_transfer',
        source_transaction_id = ${insertLocal.id}::uuid,
        source_reference_no = ${manualBillNo},
        entry_category = 'business',
        updated_at = now()
    where id = ${roz.id}::uuid;
  `;

  await tx`
    update local_purchases
    set status = 'posted',
        transferred_at = ${createdAt}::timestamp with time zone,
        journal_entry_id = ${journalInsert.id}::uuid,
        roznamcha_entry_id = ${roz.id}::uuid,
        journal_serial_no = ${journalEntryNoFull},
        debit_journal_serial = ${`${journalEntryNoFull}-DR`},
        credit_journal_serial = ${`${journalEntryNoFull}-CR`},
        super_admin_serial = (select super_admin_serial_number from roznamcha_entries where id = ${roz.id}::uuid),
        country_serial = coalesce(country_serial, (select country_transaction_serial_number from roznamcha_entries where id = ${roz.id}::uuid)),
        country_serial_no = coalesce(country_serial_no, (select country_transaction_serial_number from roznamcha_entries where id = ${roz.id}::uuid)),
        branch_serial = coalesce(branch_serial, (select branch_transaction_serial_number from roznamcha_entries where id = ${roz.id}::uuid)),
        branch_serial_no = coalesce(branch_serial_no, (select branch_transaction_serial_number from roznamcha_entries where id = ${roz.id}::uuid)),
        entry_serial = coalesce(entry_serial, (select entry_serial_number from roznamcha_entries where id = ${roz.id}::uuid)),
        updated_at = ${createdAt}::timestamp with time zone
    where id = ${insertLocal.id}::uuid
  `;

  return {
    local_purchase_id: insertLocal.id,
    manual_bill_no: manualBillNo,
    branch: branch.branch_name,
    amount,
    mode,
  };
}

async function runVerification(tx, tag) {
  const counts = await tx`
    select
      (select count(*) from roznamcha_entries where source_reference_no like ${`${tag}%`} or source_module = ${tag}) as roznamcha_entries,
      (select count(*) from roznamcha_lines rl join roznamcha_entries re on re.id = rl.roznamcha_entry_id where re.source_reference_no like ${`${tag}%`} or re.source_module = ${tag}) as roznamcha_lines,
      (select count(*) from purchase_orders where purchase_order_no like ${`${tag}%`}) as purchase_orders,
      (select count(*) from purchase_order_items poi join purchase_orders po on po.id = poi.purchase_order_id where po.purchase_order_no like ${`${tag}%`}) as purchase_order_items,
      (select count(*) from purchase_order_payments where reference_no like ${`${tag}%`}) as purchase_order_payments,
      (select count(*) from local_purchases where manual_bill_no like ${`${tag}%`}) as local_purchases,
      (select count(*) from journal_entries where memo like ${`%${tag}%`}) as journal_entries,
      (select count(*) from journal_lines jl join journal_entries je on je.id = jl.journal_entry_id where je.memo like ${`%${tag}%`}) as journal_lines
  `;

  const balance = await tx`
    select
      coalesce(sum(debit), 0) as debit_total,
      coalesce(sum(credit), 0) as credit_total
    from roznamcha_lines rl
    join roznamcha_entries re on re.id = rl.roznamcha_entry_id
    where re.source_reference_no like ${`${tag}%`}
       or re.source_module = ${tag}
  `;

  const journalBalance = await tx`
    select
      coalesce(sum(debit), 0) as debit_total,
      coalesce(sum(credit), 0) as credit_total
    from journal_lines jl
    join journal_entries je on je.id = jl.journal_entry_id
    where je.memo like ${`%${tag}%`}
  `;

  return { counts: counts[0], roznamchaBalance: balance[0], journalBalance: journalBalance[0] };
}

async function main() {
  if (!process.argv.includes("--confirm-production")) {
    throw new Error("Missing --confirm-production.");
  }
  const onlyLocal = process.argv.includes("--only-local");

  const sql = postgres(PROD_URL, {
    ssl: { rejectUnauthorized: false },
    max: 4,
    prepare: false,
  });

  try {
    const identity = await sql`
      select
        current_database() as database_name,
        current_user as db_user,
        inet_server_addr()::text as server_addr,
        inet_server_port() as server_port
    `;
    console.log("PRODUCTION_IDENTITY", JSON.stringify(identity[0], null, 2));

    const masters = await sql.begin(async (tx) => {
      await setActor(tx);
      const current = await loadMasters(tx);
      console.log("ACTOR", JSON.stringify(current.actor, null, 2));

      const repair = await repairSerialCounters(tx);
      console.log("SERIAL_REPAIR", JSON.stringify(repair, null, 2));
      return current;
    });

    const standalone = [];
    const sanaBills = [];
    if (!onlyLocal) {
      for (let batch = 0; batch < Math.ceil(STANDALONE_ROZ_COUNT / STANDALONE_ROZ_BATCH); batch += 1) {
        const start = batch * STANDALONE_ROZ_BATCH;
        const size = Math.min(STANDALONE_ROZ_BATCH, STANDALONE_ROZ_COUNT - start);
        const batchCreated = await sql.begin(async (tx) => createStandaloneRoznamchaBatch(tx, start, size, masters));
        standalone.push(...batchCreated);
        console.log(`STANDALONE_BATCH_${batch + 1}`, JSON.stringify({ created: batchCreated.length }, null, 2));
      }

      for (let i = 0; i < SANA_PURCHASE_COUNT; i += 1) {
        const bill = await sql.begin(async (tx) => createSanaPurchase(tx, i, masters));
        sanaBills.push(bill);
        console.log(`SANA_BILL_${i + 1}`, JSON.stringify(bill, null, 2));
      }
    }

    const linkedLedgers = await sql.begin(async (tx) => linkLocalPurchaseLedgers(tx));
    for (const ledger of linkedLedgers) {
      masters.ledgerByCode.set(String(ledger.code), ledger);
    }

    const localBills = [];
    for (let i = 0; i < LOCAL_PURCHASE_COUNT; i += 1) {
      const bill = await sql.begin(async (tx) => createLocalPurchase(tx, i, masters));
      localBills.push(bill);
      console.log(`LOCAL_BILL_${i + 1}`, JSON.stringify(bill, null, 2));
    }

    const verification = await sql.begin(async (tx) => runVerification(tx, SOURCE_TAG));
    console.log("VERIFICATION", JSON.stringify(verification, null, 2));

    console.log(JSON.stringify({
      ok: true,
      sourceTag: SOURCE_TAG,
      standaloneRoznamchaCreated: standalone.length,
      sanaBillsCreated: sanaBills.filter((row) => !row?.skipped).length,
      localBillsCreated: localBills.filter((row) => !row?.skipped).length,
      localBillsSkipped: localBills.filter((row) => row?.skipped).length,
      verification,
    }, null, 2));
  } finally {
    await sql.end({ timeout: 15 });
  }
}

await main();
