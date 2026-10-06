import fs from "node:fs";
import postgres from "postgres";

const SOURCE =
  "C:/Users/dgtll/.codex/attachments/0ecd206c-2392-4c44-aacf-eeabfe69a5cd/pasted-text.txt";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}

function clean(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "0" || text.toLowerCase() === "nil") return null;
  return text;
}

function accountKind(category, businessName) {
  const value = `${category ?? ""} ${businessName ?? ""}`.toLowerCase();
  const categoryValue = String(category ?? "").toLowerCase();
  if (["u", "ms", "kch"].includes(categoryValue)) return "expense";
  if (["s", "2as"].includes(categoryValue)) return "liability";
  if (value.includes("income") || value.includes("tax")) return "income";
  return "asset";
}

const arabicScriptPattern = /[\u0600-\u06ff]/;
const arabicScriptMap = {
  "\u0627": "a",
  "\u0622": "aa",
  "\u0628": "b",
  "\u067e": "p",
  "\u062a": "t",
  "\u0679": "t",
  "\u062b": "s",
  "\u062c": "j",
  "\u0686": "ch",
  "\u062d": "h",
  "\u062e": "kh",
  "\u062f": "d",
  "\u0688": "d",
  "\u0630": "z",
  "\u0631": "r",
  "\u0691": "r",
  "\u0632": "z",
  "\u0698": "zh",
  "\u0633": "s",
  "\u0634": "sh",
  "\u0635": "s",
  "\u0636": "z",
  "\u0637": "t",
  "\u0638": "z",
  "\u0639": "a",
  "\u063a": "gh",
  "\u0641": "f",
  "\u0642": "q",
  "\u06a9": "k",
  "\u0643": "k",
  "\u06af": "g",
  "\u0644": "l",
  "\u0645": "m",
  "\u0646": "n",
  "\u06ba": "n",
  "\u0648": "w",
  "\u0624": "o",
  "\u06c1": "h",
  "\u06be": "h",
  "\u0621": "",
  "\u06cc": "y",
  "\u064a": "y",
  "\u06d2": "e",
  "\u0626": "y",
  "\u0629": "h",
  "\u0649": "a",
  "\u0623": "a",
  "\u0625": "i",
  "\u064e": "",
  "\u0650": "",
  "\u064f": "",
  "\u0651": "",
  "\u0652": "",
  "\u060c": ",",
  "\u06d4": ".",
  "\u061f": "?"
};

function transliterate(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!arabicScriptPattern.test(text)) return text;
  return (
    Array.from(text)
      .map((char) => arabicScriptMap[char] ?? char)
      .join("")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase())
      .trim() || text
  );
}

function fiveLanguagePayload(value) {
  const text = clean(value);
  if (!text) return null;
  return {
    en: transliterate(text),
    ur: text,
    ar: text,
    fa: text,
    ps: text
  };
}

function parseRows() {
  const lines = fs.readFileSync(SOURCE, "utf8").split(/\r?\n/).filter(Boolean);
  const header = lines.shift()?.split("\t") ?? [];
  const parsed = lines
    .map((line, index) => {
      const cols = line.split("\t");
      return {
        accountCode: clean(cols[0]),
        category: clean(cols[1]),
        branch: clean(cols[2]),
        accountName: clean(cols[3]),
        companyName: clean(cols[4]),
        businessName: clean(cols[5]),
        city: clean(cols[6]),
        address: clean(cols[7]),
        mobile: clean(cols[8]),
        whatsapp: clean(cols[9]),
        phone: clean(cols[10]),
        email: clean(cols[11]),
        lineNo: index + 2,
        rawColumnCount: cols.length
      };
    })
    .filter((row) => row.accountCode && row.accountName);

  const byCode = new Map();
  const duplicates = [];
  for (const row of parsed) {
    if (byCode.has(row.accountCode)) {
      duplicates.push({
        accountCode: row.accountCode,
        previousLine: byCode.get(row.accountCode).lineNo,
        keptLine: row.lineNo
      });
    }
    byCode.set(row.accountCode, row);
  }

  return { header, sourceRows: parsed, uniqueRows: [...byCode.values()], duplicates };
}

async function upsertTranslation(tx, input) {
  const texts = fiveLanguagePayload(input.value);
  if (!texts) return false;
  await tx`
    insert into record_translations (
      record_table,
      record_id,
      field_name,
      original_text,
      original_language_code,
      english_text,
      urdu_text,
      arabic_text,
      persian_text,
      pashto_text,
      source,
      updated_at
    )
    values (
      ${input.recordTable},
      ${input.recordId},
      ${input.fieldName},
      ${input.value},
      'ur',
      ${texts.en},
      ${texts.ur},
      ${texts.ar},
      ${texts.fa},
      ${texts.ps},
      'imported',
      now()
    )
    on conflict (record_table, record_id, field_name)
    where deleted_at is null
    do update set
      original_text = excluded.original_text,
      original_language_code = excluded.original_language_code,
      english_text = excluded.english_text,
      urdu_text = excluded.urdu_text,
      arabic_text = excluded.arabic_text,
      persian_text = excluded.persian_text,
      pashto_text = excluded.pashto_text,
      source = excluded.source,
      updated_at = now()
  `;
  return true;
}

async function resolveTarget(sql) {
  const [country] = await sql`
    select id, name, iso2, currency_code
    from countries
    where name ilike '%Pakistan%' or iso2 = 'PK'
    order by created_at asc
    limit 1
  `;
  if (!country) throw new Error("Pakistan country was not found.");

  const [countryBranch] = await sql`
    select id, name, code
    from country_branches
    where country_id = ${country.id}
      and (name ilike '%Pakistan%' or code ilike '%PAK%')
    order by created_at asc
    limit 1
  `;
  if (!countryBranch) throw new Error("Pakistan main country branch was not found.");

  const [cityBranch] = await sql`
    select id, name, code, city_name
    from city_branches
    where country_id = ${country.id}
      and country_branch_id = ${countryBranch.id}
      and (city_name ilike '%Chaman%' or name ilike '%Chaman%' or code ilike '%CHM%' or code ilike '%CH%')
    order by created_at asc
    limit 1
  `;
  if (!cityBranch) throw new Error("Pakistan Chaman city branch was not found.");

  return { country, countryBranch, cityBranch };
}

async function nextNumericSerial(tx, columnName, fallbackStart = 1) {
  const [row] = await tx.unsafe(
    `select coalesce(max(${columnName}), 0)::int as max_value from enterprise_accounts`
  );
  return Number(row?.max_value ?? 0) + fallbackStart;
}

async function nextCountrySerial(tx, countryId) {
  const [row] = await tx`
    select coalesce(max(nullif(regexp_replace(country_serial_number, '^.*-', ''), '')::int), 0)::int as max_value
    from enterprise_accounts
    where country_id = ${countryId}
      and country_serial_number is not null
      and deleted_at is null
  `;
  return Number(row?.max_value ?? 0) + 1;
}

async function nextBranchSerial(tx, cityBranchId) {
  const [row] = await tx`
    select coalesce(max(nullif(regexp_replace(branch_serial_number, '^.*-', ''), '')::int), 0)::int as max_value
    from enterprise_accounts
    where city_branch_id = ${cityBranchId}
      and branch_serial_number is not null
      and deleted_at is null
  `;
  return Number(row?.max_value ?? 0) + 1;
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
  const parsed = parseRows();
  const dryRun = !process.argv.includes("--apply");
  const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
  await sql`set statement_timeout = 0`;
  const target = await resolveTarget(sql);

  const accountCodes = parsed.uniqueRows.map((row) => row.accountCode);
  const existing = await sql`
    select id, account_number, code, name
    from enterprise_accounts
    where account_number in ${sql(accountCodes)}
      and deleted_at is null
  `;
  const existingByCode = new Map(existing.map((row) => [row.account_number, row]));

  const report = {
    mode: dryRun ? "dry-run" : "apply",
    sourceRows: parsed.sourceRows.length,
    sourceColumns: parsed.header.length,
    uniqueAccountCodes: parsed.uniqueRows.length,
    duplicateRowsResolved: parsed.duplicates.length,
    duplicateDetails: parsed.duplicates,
    target: {
      country: target.country.name,
      currency: target.country.currency_code,
      countryBranch: target.countryBranch.name,
      countryBranchCode: target.countryBranch.code,
      cityBranch: target.cityBranch.name,
      cityBranchCode: target.cityBranch.code,
      cityName: target.cityBranch.city_name
    },
    existingToUpdate: existing.length,
    toCreate: parsed.uniqueRows.length - existing.length,
    created: 0,
    updated: 0,
    ledgersCreated: 0,
    ledgersUpdated: 0,
    historyRowsCreated: 0,
    translationRowsUpserted: 0,
    errors: []
  };

  if (dryRun) {
    console.log(JSON.stringify(report, null, 2));
    await sql.end();
    return;
  }

  await sql.begin(async (tx) => {
    let accountSerial = await nextNumericSerial(tx, "account_serial_number");
    let countrySerial = await nextCountrySerial(tx, target.country.id);
    let branchSerial = await nextBranchSerial(tx, target.cityBranch.id);

    for (const row of parsed.uniqueRows) {
      const kind = accountKind(row.category, row.businessName);
      const contacts = {
        importedFrom: "chaman-account-master-pasted-text",
        sourceLine: row.lineNo,
        sourceBranch: row.branch,
        category: row.category,
        companyName: row.companyName,
        businessName: row.businessName,
        city: row.city,
        businessAddress: row.address,
        mobile: row.mobile,
        whatsapp: row.whatsapp,
        phone: row.phone,
        email: row.email,
        originalAccountCode: row.accountCode
      };
      const basePatch = {
        scope: "city_branch",
        country_id: target.country.id,
        country_branch_id: target.countryBranch.id,
        city_branch_id: target.cityBranch.id,
        code: row.accountCode,
        account_number: row.accountCode,
        name: row.accountName,
        kind,
        currency: target.country.currency_code ?? "PKR",
        status: "active",
        is_control_account: false,
        branch_code: target.cityBranch.code,
        contacts: JSON.stringify(contacts)
      };

      let accountId;
      const existingAccount = existingByCode.get(row.accountCode);
      if (existingAccount) {
        const [updated] = await tx`
          update enterprise_accounts
          set
            scope = ${basePatch.scope}::ledger_scope,
            country_id = ${basePatch.country_id},
            country_branch_id = ${basePatch.country_branch_id},
            city_branch_id = ${basePatch.city_branch_id},
            code = ${basePatch.code},
            account_number = ${basePatch.account_number},
            name = ${basePatch.name},
            kind = ${basePatch.kind}::account_kind,
            currency = ${basePatch.currency},
            status = ${basePatch.status}::account_status,
            is_control_account = ${basePatch.is_control_account},
            branch_code = ${basePatch.branch_code},
            contacts = ${basePatch.contacts}::jsonb,
            updated_at = now()
          where id = ${existingAccount.id}
          returning id
        `;
        accountId = updated.id;
        report.updated += 1;
      } else {
        const currentCountrySerial = `PAK-${String(countrySerial).padStart(6, "0")}`;
        const currentBranchSerial = `PAK-CHM-${String(branchSerial).padStart(6, "0")}`;
        const [created] = await tx`
          insert into enterprise_accounts (
            scope,
            country_id,
            country_branch_id,
            city_branch_id,
            code,
            account_number,
            customer_number,
            account_serial_number,
            country_serial_number,
            branch_serial_number,
            branch_code,
            branch_account_sequence,
            creation_date,
            name,
            kind,
            currency,
            opening_balance,
            current_balance,
            status,
            is_control_account,
            contacts,
            created_at,
            updated_at
          )
          values (
            ${basePatch.scope}::ledger_scope,
            ${basePatch.country_id},
            ${basePatch.country_branch_id},
            ${basePatch.city_branch_id},
            ${basePatch.code},
            ${basePatch.account_number},
            ${`CUST-${row.accountCode}`},
            ${accountSerial},
            ${currentCountrySerial},
            ${currentBranchSerial},
            ${basePatch.branch_code},
            ${branchSerial},
            now(),
            ${basePatch.name},
            ${basePatch.kind}::account_kind,
            ${basePatch.currency},
            0,
            0,
            ${basePatch.status}::account_status,
            ${basePatch.is_control_account},
            ${basePatch.contacts}::jsonb,
            now(),
            now()
          )
          returning id
        `;
        accountId = created.id;
        accountSerial += 1;
        countrySerial += 1;
        branchSerial += 1;
        report.created += 1;
      }

      const normalBalance = ["liability", "equity", "income"].includes(kind) ? "credit" : "debit";
      const [ledger] = await tx`
        select id
        from ledgers
        where enterprise_account_id = ${accountId}
          and deleted_at is null
        limit 1
      `;
      if (ledger) {
        await tx`
          update ledgers
          set
            scope = 'city_branch',
            country_id = ${target.country.id},
            country_branch_id = ${target.countryBranch.id},
            city_branch_id = ${target.cityBranch.id},
            code = ${row.accountCode},
            name = ${row.accountName},
            currency = ${target.country.currency_code ?? "PKR"},
            is_active = true,
            normal_balance = ${normalBalance}::ledger_direction,
            updated_at = now()
          where id = ${ledger.id}
        `;
        report.ledgersUpdated += 1;
      } else {
        await tx`
          insert into ledgers (
            scope,
            country_id,
            country_branch_id,
            city_branch_id,
            enterprise_account_id,
            code,
            name,
            currency,
            opening_balance,
            current_balance,
            debit_total,
            credit_total,
            is_active,
            normal_balance,
            created_at,
            updated_at
          )
          values (
            'city_branch',
            ${target.country.id},
            ${target.countryBranch.id},
            ${target.cityBranch.id},
            ${accountId},
            ${row.accountCode},
            ${row.accountName},
            ${target.country.currency_code ?? "PKR"},
            0,
            0,
            0,
            0,
            true,
            ${normalBalance}::ledger_direction,
            now(),
            now()
          )
        `;
        report.ledgersCreated += 1;
      }

      await tx`
        insert into enterprise_account_history (
          enterprise_account_id,
          account_number,
          event_type,
          event_at,
          debit_total,
          credit_total,
          current_balance,
          details
        )
        values (
          ${accountId},
          ${row.accountCode},
          ${existingAccount ? "import_updated" : "import_created"},
          now(),
          0,
          0,
          0,
          ${JSON.stringify({
            source: "chaman-account-master-import",
            lineNo: row.lineNo,
            accountCode: row.accountCode,
            branch: "Pakistan / Chaman",
            branchCode: target.cityBranch.code
          })}::jsonb
        )
      `;
      report.historyRowsCreated += 1;

      const translationFields = [
        ["name", row.accountName],
        ["company_name", row.companyName],
        ["business_name", row.businessName],
        ["city", row.city],
        ["business_address", row.address],
        ["branch", row.branch]
      ];
      for (const [fieldName, value] of translationFields) {
        if (await upsertTranslation(tx, { recordTable: "enterprise_accounts", recordId: accountId, fieldName, value })) {
          report.translationRowsUpserted += 1;
        }
      }
      if (await upsertTranslation(tx, { recordTable: "ledgers", recordId: accountId, fieldName: "name", value: row.accountName })) {
        report.translationRowsUpserted += 1;
      }
    }
  });

  const verification = await sql`
    select
      count(*)::int as chaman_accounts,
      count(*) filter (where account_number in ${sql(accountCodes)})::int as supplied_codes_found,
      count(*) filter (where city_branch_id = ${target.cityBranch.id})::int as chaman_scope_found
    from enterprise_accounts
    where account_number in ${sql(accountCodes)}
      and deleted_at is null
  `;
  const duplicateAccountNumbers = await sql`
    select account_number, count(*)::int as count
    from enterprise_accounts
    where account_number is not null
      and deleted_at is null
    group by account_number
    having count(*) > 1
    order by count desc, account_number asc
    limit 20
  `;
  const linkedLedgers = await sql`
    select count(*)::int as count
    from ledgers l
    join enterprise_accounts a on a.id = l.enterprise_account_id
    where a.account_number in ${sql(accountCodes)}
      and a.deleted_at is null
      and l.deleted_at is null
  `;
  const translationCount = await sql`
    select count(*)::int as count
    from record_translations rt
    join enterprise_accounts a on a.id = rt.record_id
    where rt.record_table = 'enterprise_accounts'
      and a.account_number in ${sql(accountCodes)}
      and rt.deleted_at is null
  `;

  const finalReport = {
    ...report,
    verification: {
      suppliedCodesFound: verification[0]?.supplied_codes_found ?? 0,
      chamanScopedSuppliedCodes: verification[0]?.chaman_scope_found ?? 0,
      linkedLedgers: linkedLedgers[0]?.count ?? 0,
      accountTranslationRows: translationCount[0]?.count ?? 0,
      duplicateActiveAccountNumbers: duplicateAccountNumbers
    }
  };

  fs.mkdirSync("_codex", { recursive: true });
  fs.writeFileSync("_codex/chaman-account-master-import-report.json", JSON.stringify(finalReport, null, 2));
  console.log(JSON.stringify(finalReport, null, 2));
  await sql.end();
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error.message, stack: error.stack }, null, 2));
  process.exitCode = 1;
});


