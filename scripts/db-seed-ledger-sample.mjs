import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

function normalBalanceForKind(kind) {
  // Standard accounting: assets/expenses are debit-normal; others are credit-normal.
  return kind === "asset" || kind === "expense" ? "debit" : "credit";
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

async function createEnterpriseAccount({ scope, countryId, code, name, kind, currency }) {
  const [existing] = await sql`
    select id
    from enterprise_accounts
    where scope = ${scope}::ledger_scope
      and coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(${countryId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = '00000000-0000-0000-0000-000000000000'::uuid
      and coalesce(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = '00000000-0000-0000-0000-000000000000'::uuid
      and code = ${code}
      and deleted_at is null
    limit 1
  `;
  if (existing?.id) return existing.id;

  const [row] = await sql`
    insert into enterprise_accounts (
      scope,
      country_id,
      country_branch_id,
      city_branch_id,
      parent_id,
      code,
      name,
      kind,
      currency,
      opening_balance,
      current_balance,
      status,
      is_control_account,
      created_at,
      updated_at
    )
    values (
      ${scope}::ledger_scope,
      ${countryId}::uuid,
      null,
      null,
      null,
      ${code},
      ${name},
      ${kind}::account_kind,
      ${currency},
      0,
      0,
      'active'::account_status,
      false,
      now(),
      now()
    )
    returning id
  `;
  return row.id;
}

async function createLedger({ scope, countryId, enterpriseAccountId, code, name, currency, normalBalance }) {
  const [existing] = await sql`
    select id
    from ledgers
    where scope = ${scope}::ledger_scope
      and coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(${countryId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
      and coalesce(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = '00000000-0000-0000-0000-000000000000'::uuid
      and coalesce(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = '00000000-0000-0000-0000-000000000000'::uuid
      and code = ${code}
      and deleted_at is null
    limit 1
  `;
  if (existing?.id) return existing.id;

  const [row] = await sql`
    insert into ledgers (
      scope,
      country_id,
      country_branch_id,
      city_branch_id,
      enterprise_account_id,
      parent_ledger_id,
      code,
      name,
      currency,
      opening_balance,
      current_balance,
      debit_total,
      credit_total,
      normal_balance,
      is_active,
      created_at,
      updated_at
    )
    values (
      ${scope}::ledger_scope,
      ${countryId}::uuid,
      null,
      null,
      ${enterpriseAccountId}::uuid,
      null,
      ${code},
      ${name},
      ${currency},
      0,
      0,
      0,
      0,
      ${normalBalance}::ledger_direction,
      true,
      now(),
      now()
    )
    returning id
  `;
  return row.id;
}

async function ensureSeedForScope({ scope, countryId, currency, labelPrefix }) {
  const cashAccId = await createEnterpriseAccount({
    scope,
    countryId,
    code: "CASH",
    name: `${labelPrefix} Cash`,
    kind: "asset",
    currency
  });
  const incomeAccId = await createEnterpriseAccount({
    scope,
    countryId,
    code: "INCOME",
    name: `${labelPrefix} Income`,
    kind: "income",
    currency
  });

  const cashLedgerId = await createLedger({
    scope,
    countryId,
    enterpriseAccountId: cashAccId,
    code: "CASH",
    name: `${labelPrefix} Cash Ledger`,
    currency,
    normalBalance: normalBalanceForKind("asset")
  });

  const incomeLedgerId = await createLedger({
    scope,
    countryId,
    enterpriseAccountId: incomeAccId,
    code: "INCOME",
    name: `${labelPrefix} Income Ledger`,
    currency,
    normalBalance: normalBalanceForKind("income")
  });

  // Seed one balanced batch so the Ledger Report UI shows real rows.
  const [batch] = await sql`
    select id
    from ledger_posting_batches
    where scope = ${scope}::ledger_scope
      and coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(${countryId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
      and reference_no = ${`${labelPrefix}-SEED-0001`}
      and deleted_at is null
    limit 1
  `;

  if (!batch?.id) {
    const entryDate = new Date().toISOString().slice(0, 10);
    const referenceNo = `${labelPrefix}-SEED-0001`;

    const [newBatch] = await sql`
      insert into ledger_posting_batches (
        scope,
        country_id,
        country_branch_id,
        city_branch_id,
        entry_date,
        reference_no,
        narration,
        status,
        created_at,
        updated_at
      )
      values (
        ${scope}::ledger_scope,
        ${countryId}::uuid,
        null,
        null,
        ${entryDate}::date,
        ${referenceNo},
        'Seed entry (demo)',
        'posted'::document_status,
        now(),
        now()
      )
      returning id
    `;

    const amount = 1000;
    const usdRate = currency === "USD" ? 1 : 1;

    // Debit CASH
    await sql`
      insert into ledger_posting_lines (
        batch_id,
        enterprise_account_id,
        ledger_id,
        description,
        debit,
        credit,
        currency,
        usd_rate,
        usd_amount,
        created_at
      )
      values (
        ${newBatch.id}::uuid,
        ${cashAccId}::uuid,
        ${cashLedgerId}::uuid,
        'Seed debit',
        ${amount},
        0,
        ${currency},
        ${usdRate},
        ${amount * usdRate},
        now()
      )
    `;

    // Credit INCOME
    await sql`
      insert into ledger_posting_lines (
        batch_id,
        enterprise_account_id,
        ledger_id,
        description,
        debit,
        credit,
        currency,
        usd_rate,
        usd_amount,
        created_at
      )
      values (
        ${newBatch.id}::uuid,
        ${incomeAccId}::uuid,
        ${incomeLedgerId}::uuid,
        'Seed credit',
        0,
        ${amount},
        ${currency},
        ${usdRate},
        ${amount * usdRate},
        now()
      )
    `;

    // Update ledger rollups (simple demo totals).
    await sql`
      update ledgers
      set current_balance = current_balance + ${amount},
          debit_total = debit_total + ${amount},
          updated_at = now()
      where id = ${cashLedgerId}::uuid
    `;

    await sql`
      update ledgers
      set current_balance = current_balance + ${amount},
          credit_total = credit_total + ${amount},
          normal_balance = 'credit'::ledger_direction,
          updated_at = now()
      where id = ${incomeLedgerId}::uuid
    `;
  }
}

try {
  const [countRow] = await sql`select count(*)::int as c from enterprise_accounts where deleted_at is null`;
  if (countRow.c > 0) {
    console.log("enterprise_accounts already present; skipping seed.");
    process.exit(0);
  }

  // Super Admin (global)
  await ensureSeedForScope({ scope: "super_admin", countryId: null, currency: "USD", labelPrefix: "GLOBAL" });

  // Country scope seeds
  const countries = await sql`select id, name, currency_code from countries where deleted_at is null order by name`;
  for (const c of countries) {
    const prefix = String(c.name || "COUNTRY").toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 10);
    await ensureSeedForScope({ scope: "country", countryId: c.id, currency: c.currency_code, labelPrefix: prefix });
  }

  console.log("Seeded enterprise accounts, ledgers, and sample postings.");
} catch (error) {
  console.error("Failed to seed ledger sample data:");
  console.error(error?.message || error);
  process.exit(1);
} finally {
  await sql.end();
}

