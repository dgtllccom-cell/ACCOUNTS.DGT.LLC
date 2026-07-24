import fs from "node:fs";
import postgres from "postgres";

const SOURCE =
  "C:/Users/dgtll/.codex/attachments/87971062-af23-48fb-bf24-199d3a14f214/pasted-text.txt";

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

const arabicScriptPattern = /[\u0600-\u06ff]/;
const arabicScriptMap = {
  "\u0627": "a", "\u0622": "aa", "\u0628": "b", "\u067e": "p", "\u062a": "t", "\u0679": "t", "\u062b": "s", "\u062c": "j", "\u0686": "ch", "\u062d": "h", "\u062e": "kh", "\u062f": "d", "\u0688": "d", "\u0630": "z", "\u0631": "r", "\u0691": "r", "\u0632": "z", "\u0698": "zh", "\u0633": "s", "\u0634": "sh", "\u0635": "s", "\u0636": "z", "\u0637": "t", "\u0638": "z", "\u0639": "a", "\u063a": "gh", "\u0641": "f", "\u0642": "q", "\u06a9": "k", "\u0643": "k", "\u06af": "g", "\u0644": "l", "\u0645": "m", "\u0646": "n", "\u06ba": "n", "\u0648": "w", "\u0624": "o", "\u06c1": "h", "\u06be": "h", "\u0621": "", "\u06cc": "y", "\u064a": "y", "\u06d2": "e", "\u0626": "y", "\u0629": "h", "\u0649": "a", "\u0623": "a", "\u0625": "i", "\u064e": "", "\u0650": "", "\u064f": "", "\u0651": "", "\u0652": "", "\u060c": ",", "\u06d4": ".", "\u061f": "?"
};
function containsArabicScript(value) { return arabicScriptPattern.test(String(value ?? "")); }
function transliterateArabicScriptToLatin(value) { const text = String(value ?? "").trim(); if (!text) return ""; return Array.from(text).map((char) => arabicScriptMap[char] ?? char).join("").replace(/\s+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()).trim() || text; }
function clean(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "0" || text.toLowerCase() === "nil") return null;
  return text;
}

function normalizeManualRef(value, fallbackIndex) {
  const raw = clean(value) ?? `LEGACY-${fallbackIndex}`;
  return raw.replace(/\s+/g, "-").toUpperCase().slice(0, 80);
}

function parseRows() {
  const lines = fs.readFileSync(SOURCE, "utf8").split(/\r?\n/).filter(Boolean);
  lines.shift();
  const seen = new Map();
  return lines.map((line, index) => {
    const cols = line.split("\t");
    const legacyRef = normalizeManualRef(cols[0], index + 1);
    const count = seen.get(legacyRef) ?? 0;
    seen.set(legacyRef, count + 1);
    const manualReferenceNumber = count ? `${legacyRef}-${count + 1}` : legacyRef;
    return {
      manualReferenceNumber,
      name: clean(cols[3]),
      companyName: clean(cols[4]),
      businessName: clean(cols[5]),
      city: clean(cols[6]),
      address: clean(cols[7])
    };
  });
}

function fiveLanguagePayload(originalText) {
  const text = clean(originalText);
  if (!text) return null;
  return {
    en: containsArabicScript(text) ? transliterateArabicScriptToLatin(text) : text,
    ur: text,
    ar: text,
    fa: text,
    ps: text
  };
}

async function upsertTranslation(sql, input) {
  const texts = fiveLanguagePayload(input.value);
  if (!texts) return false;
  await sql`
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

loadEnv();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");

const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
await sql`set statement_timeout = 0`;

const rows = parseRows();
const refs = rows.map((row) => row.manualReferenceNumber);

const [pakistan] = await sql`
  select id, name, currency_code
  from countries
  where name ilike '%Pakistan%'
  limit 1
`;
if (!pakistan) throw new Error("Pakistan country not found.");

const [mainBranch] = await sql`
  select id, name, code
  from country_branches
  where country_id = ${pakistan.id}
    and name ilike '%Pakistan%'
  limit 1
`;
if (!mainBranch) throw new Error("Pakistan main branch not found.");

const [chamanBranch] = await sql`
  select id, name, code, city_name
  from city_branches
  where country_id = ${pakistan.id}
    and country_branch_id = ${mainBranch.id}
    and (city_name ilike '%Chaman%' or name ilike '%Chaman%' or code ilike '%CHM%' or code ilike '%CH%')
  order by created_at asc
  limit 1
`;
if (!chamanBranch) throw new Error("Chaman city branch not found.");

const importedAccounts = await sql`
  select id, account_number, code, manual_reference_number, name, country_serial_number
  from enterprise_accounts
  where manual_reference_number in ${sql(refs)}
    and deleted_at is null
  order by created_at asc
`;

let moved = 0;
let translatedRows = 0;
let sequence = 1;

await sql.begin(async (tx) => {
  for (const account of importedAccounts) {
    const code = `PK-CHM-AC-${String(sequence).padStart(6, "0")}`;
    const customerNumber = `CUST-${code}`;
    const branchSerialNumber = `PAK-CHM-${String(sequence).padStart(6, "0")}`;

    await tx`
      update enterprise_accounts
      set
        scope = 'city_branch',
        country_id = ${pakistan.id},
        country_branch_id = ${mainBranch.id},
        city_branch_id = ${chamanBranch.id},
        code = ${code},
        account_number = ${code},
        customer_number = ${customerNumber},
        branch_code = ${chamanBranch.code},
        branch_serial_number = ${branchSerialNumber},
        branch_account_sequence = ${sequence},
        currency = ${pakistan.currency_code ?? "PKR"},
        updated_at = now()
      where id = ${account.id}
    `;

    await tx`
      update ledgers
      set
        scope = 'city_branch',
        country_id = ${pakistan.id},
        country_branch_id = ${mainBranch.id},
        city_branch_id = ${chamanBranch.id},
        code = ${code},
        currency = ${pakistan.currency_code ?? "PKR"},
        updated_at = now()
      where enterprise_account_id = ${account.id}
    `;

    const historyDetails = {
      movedToBranch: "Chaman",
      customerNumber,
      countrySerialNumber: account.country_serial_number,
      branchSerialNumber,
      manualReferenceNumber: account.manual_reference_number,
      branchCode: chamanBranch.code,
      branchAccountSequence: sequence,
    };

    await tx`
      update enterprise_account_history
      set
        account_number = ${code},
        details = ${JSON.stringify(historyDetails)}::jsonb
      where enterprise_account_id = ${account.id}
    `;

    const source = rows.find((row) => row.manualReferenceNumber === account.manual_reference_number);
    translatedRows += (await upsertTranslation(tx, {
      recordTable: "enterprise_accounts",
      recordId: account.id,
      fieldName: "name",
      value: source?.name ?? account.name
    }))
      ? 1
      : 0;
    translatedRows += (await upsertTranslation(tx, {
      recordTable: "enterprise_accounts",
      recordId: account.id,
      fieldName: "company_name",
      value: source?.companyName
    }))
      ? 1
      : 0;
    translatedRows += (await upsertTranslation(tx, {
      recordTable: "enterprise_accounts",
      recordId: account.id,
      fieldName: "business_name",
      value: source?.businessName
    }))
      ? 1
      : 0;
    translatedRows += (await upsertTranslation(tx, {
      recordTable: "enterprise_accounts",
      recordId: account.id,
      fieldName: "business_address",
      value: source?.address
    }))
      ? 1
      : 0;

    moved += 1;
    sequence += 1;
  }
});

const [counts] = await sql`
  select
    count(*) filter (where ea.manual_reference_number in ${sql(refs)})::int as imported_accounts,
    count(*) filter (where ea.manual_reference_number in ${sql(refs)} and ea.city_branch_id = ${chamanBranch.id})::int as imported_in_chaman
  from enterprise_accounts ea
  where ea.deleted_at is null
`;

const [translationCount] = await sql`
  select count(*)::int as count
  from record_translations rt
  join enterprise_accounts ea on ea.id = rt.record_id
  where rt.record_table = 'enterprise_accounts'
    and ea.manual_reference_number in ${sql(refs)}
    and rt.deleted_at is null
`;

const sample = await sql`
  select
    ea.account_number,
    ea.manual_reference_number,
    ea.name,
    ea.branch_code,
    ea.branch_serial_number,
    rt.english_text,
    rt.urdu_text,
    rt.arabic_text,
    rt.persian_text,
    rt.pashto_text
  from enterprise_accounts ea
  left join record_translations rt
    on rt.record_table = 'enterprise_accounts'
   and rt.record_id = ea.id
   and rt.field_name = 'name'
   and rt.deleted_at is null
  where ea.manual_reference_number in ${sql(refs.slice(0, 3))}
  order by ea.account_number asc
`;

await sql.end();

console.log(
  JSON.stringify(
    {
      sourceRows: rows.length,
      movedToChaman: moved,
      importedAccounts: counts.imported_accounts,
      importedAccountsInChaman: counts.imported_in_chaman,
      translationRowsUpsertedThisRun: translatedRows,
      translationRowsInDatabase: translationCount.count,
      targetBranch: {
        country: pakistan.name,
        mainBranch: mainBranch.name,
        cityBranch: chamanBranch.name,
        cityName: chamanBranch.city_name,
        branchCode: chamanBranch.code
      },
      sample
    },
    null,
    2
  )
);










