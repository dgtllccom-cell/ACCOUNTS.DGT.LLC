import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is not set");

const sql = postgres(dbUrl, { prepare: false });

async function insertMainAccounts() {
  console.log("Looking up Pakistan and Chaman Branch...");
  const [pakistan] = await sql`select id, currency_code from countries where name = 'Pakistan' and deleted_at is null limit 1`;
  const [mainBranch] = await sql`select id from country_branches where country_id = ${pakistan.id} and is_main_branch = true and deleted_at is null limit 1`;
  const [chamanBranch] = await sql`select id, code from city_branches where country_id = ${pakistan.id} and name = 'Chaman Branch' and deleted_at is null limit 1`;

  if (!pakistan || !mainBranch || !chamanBranch) {
    console.error("Could not find Pakistan or Chaman Branch.");
    await sql.end();
    return;
  }

  const [maxes] = await sql`
    select
      max(branch_account_sequence)::int as max_branch_sequence,
      max(account_serial_number)::int as max_account_serial,
      max(country_serial_number_numeric)::int as max_country_serial
    from enterprise_accounts
    where deleted_at is null
  `;

  let branchSeq = Number(maxes.max_branch_sequence ?? 0) + 1;
  let globalSeq = Number(maxes.max_account_serial ?? 0) + 1;
  let countrySeq = Number(maxes.max_country_serial ?? 0) + 1;

  const accountsToInsert = [
    { name: "Main Cash Account", category: "Asset", kind: "asset" },
    { name: "Main Bank Account", category: "Asset", kind: "asset" }
  ];

  await sql.begin(async (tx) => {
    for (const acc of accountsToInsert) {
      const code = `CHM-${String(branchSeq).padStart(6, "0")}`;
      const customerNumber = `CUST-${code}`;
      const countrySerialNumber = `PAK-${String(countrySeq).padStart(6, "0")}`;
      const branchSerialNumber = `PAK-CHM-${String(branchSeq).padStart(6, "0")}`;

      const [account] = await tx`
        insert into enterprise_accounts (
          scope, country_id, country_branch_id, city_branch_id,
          code, account_number, customer_number, account_serial_number,
          country_serial_number, branch_serial_number, manual_reference_number,
          creation_date, branch_code, branch_account_sequence,
          name, kind, currency, opening_balance, current_balance, status,
          is_control_account, contacts
        ) values (
          'city_branch', ${pakistan.id}, ${mainBranch.id}, ${chamanBranch.id},
          ${code}, ${code}, ${customerNumber}, ${globalSeq},
          ${countrySerialNumber}, ${branchSerialNumber}, ${"MAIN-ACC-" + branchSeq},
          now(), ${chamanBranch.code}, ${branchSeq},
          ${acc.name}, ${acc.kind}, ${pakistan.currency_code ?? "PKR"}, 0, 0, 'active',
          false, '{}'::jsonb
        ) returning id, account_number
      `;

      const [ledger] = await tx`
        insert into ledgers (
          scope, country_id, country_branch_id, city_branch_id,
          enterprise_account_id, code, name, currency,
          opening_balance, current_balance, debit_total, credit_total,
          normal_balance, is_active
        ) values (
          'city_branch', ${pakistan.id}, ${mainBranch.id}, ${chamanBranch.id},
          ${account.id}, ${code}, ${acc.name}, ${pakistan.currency_code ?? "PKR"},
          0, 0, 0, 0, 'debit', true
        ) returning id
      `;

      await tx`
        insert into enterprise_account_history (
          enterprise_account_id, account_number, event_type,
          debit_total, credit_total, current_balance, details
        ) values (
          ${account.id}, ${code}, 'created', 0, 0, 0,
          ${JSON.stringify({ linkedLedgerId: ledger.id, note: "Inserted via script" })}::jsonb
        )
      `;

      console.log(`Inserted ${acc.name} with code ${code} into Chaman Branch.`);

      branchSeq++;
      globalSeq++;
      countrySeq++;
    }
  });

  await sql.end();
  console.log("Done inserting Main Accounts into Chaman Branch!");
}

insertMainAccounts().catch(console.error);
