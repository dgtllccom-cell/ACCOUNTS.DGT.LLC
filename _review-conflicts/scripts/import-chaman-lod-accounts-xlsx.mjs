import fs from "node:fs";
import postgres from "postgres";

const SOURCE_JSON = "C:/tmp/chaman-lod-accounts.json";
const XLSX_PATH = "C:/Users/dgtll/OneDrive/Desktop/chaman lod accounts.xlsx";

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

const arabicScriptPattern = /[\u0600-\u06ff]/;
const arabicScriptMap = {
  "\u0627": "a", "\u0622": "aa", "\u0628": "b", "\u067e": "p", "\u062a": "t", "\u0679": "t", "\u062b": "s", "\u062c": "j", "\u0686": "ch", "\u062d": "h", "\u062e": "kh", "\u062f": "d", "\u0688": "d", "\u0630": "z", "\u0631": "r", "\u0691": "r", "\u0632": "z", "\u0698": "zh", "\u0633": "s", "\u0634": "sh", "\u0635": "s", "\u0636": "z", "\u0637": "t", "\u0638": "z", "\u0639": "a", "\u063a": "gh", "\u0641": "f", "\u0642": "q", "\u06a9": "k", "\u0643": "k", "\u06af": "g", "\u0644": "l", "\u0645": "m", "\u0646": "n", "\u06ba": "n", "\u0648": "w", "\u0624": "o", "\u06c1": "h", "\u06be": "h", "\u0621": "", "\u06cc": "y", "\u064a": "y", "\u06d2": "e", "\u0626": "y", "\u0629": "h", "\u0649": "a", "\u0623": "a", "\u0625": "i", "\u064e": "", "\u0650": "", "\u064f": "", "\u0651": "", "\u0652": "", "\u060c": ",", "\u06d4": ".", "\u061f": "?"
};
function containsArabicScript(value) { return arabicScriptPattern.test(String(value ?? "")); }
function transliterateArabicScriptToLatin(value) { const text = String(value ?? "").trim(); if (!text) return ""; return Array.from(text).map((char) => arabicScriptMap[char] ?? char).join("").replace(/\s+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()).trim() || text; }
function clean(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "0" || text.toLowerCase() === "nil") return null;
  return text.replace(/\u00a0/g, " ").trim();
}

function normalizeManualRef(value, fallbackIndex) {
  const raw = clean(value) ?? `CHM-LEGACY-${fallbackIndex}`;
  return raw.replace(/\s+/g, "-").toUpperCase().slice(0, 80);
}

function accountKind(category, businessName) {
  const value = `${category ?? ""} ${businessName ?? ""}`.toLowerCase();
  const cat = String(category ?? "").toLowerCase();
  if (["u", "kch"].includes(cat)) return "expense";
  if (["s", "2as"].includes(cat)) return "liability";
  if (value.includes("income") || value.includes("tax")) return "income";
  return "asset";
}

function fiveText(value) {
  const text = clean(value);
  if (!text) return null;
  return { en: containsArabicScript(text) ? transliterateArabicScriptToLatin(text) : text, ar: text, ur: text, fa: text, ps: text };
}

function parseRows() {
  const rawRows = JSON.parse(fs.readFileSync(SOURCE_JSON, "utf8"));
  const seen = new Map();
  return rawRows.map((row, index) => {
    const legacyRef = normalizeManualRef(row[0], index + 1);
    const count = seen.get(legacyRef) ?? 0;
    seen.set(legacyRef, count + 1);
    const manualReferenceNumber = count ? `${legacyRef}-${count + 1}` : legacyRef;
    return {
      legacyRef,
      manualReferenceNumber,
      category: clean(row[1]),
      sourceBranch: clean(row[2]),
      accountName: clean(row[3]) ?? `Chaman Account ${index + 1}`,
      companyName: clean(row[4]),
      businessName: clean(row[5]),
      city: clean(row[6]),
      address: clean(row[7]),
      mobile: clean(row[8]),
      whatsapp: clean(row[9]),
      phone: clean(row[10]),
      email: clean(row[11]),
      lineNo: index + 2
    };
  }).filter((row) => row.accountName);
}

async function upsertTranslation(tx, recordId, fieldName, value) {
  const texts = fiveText(value);
  if (!texts) return 0;
  await tx`
    insert into record_translations (
      record_table, record_id, field_name, original_text, original_language_code,
      english_text, arabic_text, urdu_text, persian_text, pashto_text, source, updated_at
    ) values (
      'enterprise_accounts', ${recordId}, ${fieldName}, ${value}, 'ur',
      ${texts.en}, ${texts.ar}, ${texts.ur}, ${texts.fa}, ${texts.ps}, 'imported', now()
    )
    on conflict (record_table, record_id, field_name)
    where deleted_at is null
    do update set
      original_text = excluded.original_text,
      original_language_code = excluded.original_language_code,
      english_text = excluded.english_text,
      arabic_text = excluded.arabic_text,
      urdu_text = excluded.urdu_text,
      persian_text = excluded.persian_text,
      pashto_text = excluded.pashto_text,
      source = excluded.source,
      updated_at = now()
  `;
  return 1;
}

loadEnv();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
if (!fs.existsSync(SOURCE_JSON)) throw new Error(`Missing parsed Excel JSON: ${SOURCE_JSON}`);

console.log("Connecting to database...");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, idle_timeout: 1, prepare: false });
console.log("Connected! Setting timeout...");
await sql`set statement_timeout = 0`;
console.log("Parsing rows...");
const rows = parseRows();
const refs = rows.map((row) => row.manualReferenceNumber);

console.log("Looking up country and branches...");
const [pakistan] = await sql`select id, name, currency_code from countries where name ilike '%Pakistan%' and deleted_at is null limit 1`;
if (!pakistan) throw new Error("Pakistan country not found.");
const [mainBranch] = await sql`select id, name, code from country_branches where country_id=${pakistan.id} and deleted_at is null and (name ilike '%Pakistan%' or code ilike '%PAK%') order by created_at asc limit 1`;
if (!mainBranch) throw new Error("Pakistan main branch not found.");
const [chamanBranch] = await sql`select id, name, code, city_name from city_branches where country_id=${pakistan.id} and country_branch_id=${mainBranch.id} and deleted_at is null and (city_name ilike '%Chaman%' or name ilike '%Chaman%' or code ilike '%CHM%' or code ilike '%CH%') order by created_at asc limit 1`;
if (!chamanBranch) throw new Error("Chaman branch not found.");

console.log("Checking for existing rows in Chaman Branch...");
const existingRows = await sql`
  select manual_reference_number, name 
  from enterprise_accounts 
  where manual_reference_number in ${sql(refs)} 
    and city_branch_id=${chamanBranch.id} 
    and deleted_at is null
`;
const existingMap = new Map(existingRows.map(r => [r.manual_reference_number, r.name]));
const rowsToInsert = rows.filter((row) => {
  const existingName = existingMap.get(row.manualReferenceNumber);
  if (existingName !== undefined && existingName === row.accountName) {
    return false; // Exact duplicate in Chaman Branch
  }
  return true; // Not in Chaman Branch, or different name
});
console.log(`Found ${rowsToInsert.length} new accounts to insert into Chaman Branch.`);

console.log("Fetching max sequences...");
const [maxes] = await sql`
  select
    coalesce(max(account_serial_number),0)::bigint as max_account_serial,
    coalesce(max(branch_account_sequence) filter (where city_branch_id=${chamanBranch.id}),0)::bigint as max_branch_sequence,
    coalesce(max((regexp_match(country_serial_number, '([0-9]+)$'))[1]::bigint) filter (where country_id=${pakistan.id}),0)::bigint as max_country_serial
  from enterprise_accounts
`;

const usedCodeRows = await sql`select code from enterprise_accounts where scope='city_branch' and country_id=${pakistan.id} and country_branch_id=${mainBranch.id} and city_branch_id=${chamanBranch.id}`;
const usedCodes = new Set(usedCodeRows.map((row) => row.code));
function nextFreeCode(seq) {
  let n = seq;
  while (n < 1000000) {
    const code = `PK-CHM-AC-${String(n).padStart(6, "0")}`;
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return { code, sequence: n };
    }
    n += 1;
  }
  throw new Error("No free Chaman account code is available.");
}

let inserted = 0;
let translations = 0;
const sample = [];
let branchSeq = Number(maxes.max_branch_sequence ?? 0) + 1;
let globalSeq = Number(maxes.max_account_serial ?? 0) + 1;
let countrySeq = Number(maxes.max_country_serial ?? 0) + 1;
let codeSeed = branchSeq;

console.log("Inserting records...");
await sql.begin(async (tx) => {
  for (const row of rowsToInsert) {
    const { code, sequence } = nextFreeCode(codeSeed);
    codeSeed = sequence + 1;
    const customerNumber = `CUST-${code}`;
    const countrySerialNumber = `PAK-${String(countrySeq).padStart(6, "0")}`;
    const branchSerialNumber = `PAK-CHM-${String(branchSeq).padStart(6, "0")}`;
    const kind = accountKind(row.category, row.businessName);
    const contacts = {
      importedFrom: XLSX_PATH,
      sourceLine: row.lineNo,
      sourceBranch: row.sourceBranch,
      companyName: row.companyName,
      businessName: row.businessName,
      city: row.city,
      address: row.address,
      mobile: row.mobile,
      whatsapp: row.whatsapp,
      phone: row.phone,
      email: row.email,
      legacyCategory: row.category,
      legacyReference: row.legacyRef
    };

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
        ${countrySerialNumber}, ${branchSerialNumber}, ${row.manualReferenceNumber},
        now(), ${chamanBranch.code}, ${branchSeq},
        ${row.accountName}, ${kind}, ${pakistan.currency_code ?? "PKR"}, 0, 0, 'active',
        false, ${JSON.stringify(contacts)}::jsonb
      ) returning id, account_number
    `;

    const normalBalance = kind === "liability" || kind === "income" ? "credit" : "debit";
    const [ledger] = await tx`
      insert into ledgers (
        scope, country_id, country_branch_id, city_branch_id,
        enterprise_account_id, code, name, currency,
        opening_balance, current_balance, debit_total, credit_total,
        normal_balance, is_active
      ) values (
        'city_branch', ${pakistan.id}, ${mainBranch.id}, ${chamanBranch.id},
        ${account.id}, ${code}, ${row.accountName}, ${pakistan.currency_code ?? "PKR"},
        0, 0, 0, 0, ${normalBalance}, true
      ) returning id
    `;

    await tx`
      insert into enterprise_account_history (
        enterprise_account_id, account_number, event_type,
        debit_total, credit_total, current_balance, details
      ) values (
        ${account.id}, ${code}, 'created', 0, 0, 0,
        ${JSON.stringify({ ...contacts, customerNumber, accountSerialNumber: globalSeq, countrySerialNumber, branchSerialNumber, manualReferenceNumber: row.manualReferenceNumber, branchCode: chamanBranch.code, branchAccountSequence: branchSeq, linkedLedgerId: ledger.id })}::jsonb
      )
    `;

    translations += await upsertTranslation(tx, account.id, "name", row.accountName);
    translations += await upsertTranslation(tx, account.id, "company_name", row.companyName);
    translations += await upsertTranslation(tx, account.id, "business_name", row.businessName);
    translations += await upsertTranslation(tx, account.id, "business_address", row.address);
    translations += await upsertTranslation(tx, account.id, "city", row.city);

    inserted += 1;
    if (sample.length < 10) sample.push({ manualReference: row.manualReferenceNumber, accountNumber: code, name: row.accountName });
    branchSeq += 1;
    globalSeq += 1;
    countrySeq += 1;
  }
});

const [counts] = await sql`
  select
    count(*) filter (where manual_reference_number in ${sql(refs)})::int as source_matches,
    count(*) filter (where manual_reference_number in ${sql(refs)} and city_branch_id=${chamanBranch.id})::int as in_chaman
  from enterprise_accounts
  where deleted_at is null
`;
const [ledgerCounts] = await sql`select count(*)::int as count from ledgers where city_branch_id=${chamanBranch.id} and enterprise_account_id is not null and deleted_at is null`;
const [translationCounts] = await sql`
  select count(*)::int as count
  from record_translations rt
  join enterprise_accounts ea on ea.id=rt.record_id
  where rt.record_table='enterprise_accounts'
    and ea.manual_reference_number in ${sql(refs)}
    and rt.deleted_at is null
`;
const verifySample = await sql`
  select account_number, manual_reference_number, customer_number, name, branch_code, branch_serial_number, currency
  from enterprise_accounts
  where manual_reference_number in ${sql(refs.slice(0,5))} and deleted_at is null
  order by account_number asc
`;
await sql.end();
console.log(JSON.stringify({
  sourceRows: rows.length,
  existingSkipped: existingMap.size,
  inserted,
  translationsUpserted: translations,
  target: { country: pakistan.name, mainBranch: mainBranch.name, cityBranch: chamanBranch.name, cityName: chamanBranch.city_name, branchCode: chamanBranch.code },
  sourceMatches: counts.source_matches,
  sourceAccountsInChaman: counts.in_chaman,
  chamanLinkedLedgersTotal: ledgerCounts.count,
  sourceTranslationRows: translationCounts.count,
  insertedSample: sample,
  verifySample
}, null, 2));
console.log("Done!");
