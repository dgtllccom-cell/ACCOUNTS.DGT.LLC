import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import postgres from "postgres";

const XLSX_PATH = "C:/Users/dgtll/OneDrive/Desktop/Accounts_2026-06-27.xlsx";
const TEMP_JSON = "C:/tmp/allah_rahm_parsed.json";

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
  return text.replace(/\u00a0/g, " ").trim();
}

function normalizeManualRef(value, fallbackIndex) {
  const raw = clean(value) ?? `ALR-LEGACY-${fallbackIndex}`;
  return raw.replace(/\s+/g, "-").toUpperCase().slice(0, 80);
}

function accountKind(name) {
  const lower = String(name ?? "").toLowerCase();
  if (lower.includes("expense") || lower.includes("expence") || lower.includes("khrch") || lower.includes("kharcha")) {
    return "expense";
  }
  if (lower.includes("bank") || lower.includes("cash") || lower.includes("asset")) {
    return "asset";
  }
  return "asset"; // Default kind is asset
}

function fiveText(value) {
  const text = clean(value);
  if (!text) return null;
  return { en: containsArabicScript(text) ? transliterateArabicScriptToLatin(text) : text, ar: text, ur: text, fa: text, ps: text };
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

// Inline Python parser runner to extract sheet3 to JSON
function extractExcelToJson() {
  console.log("Extracting Sheet 3 from Excel...");
  const tempPath = "C:/tmp/accounts_copy.xlsx";
  fs.copyFileSync(XLSX_PATH, tempPath);

  const pyScript = `
import zipfile
import xml.etree.ElementTree as ET
import os
import json

def parse_xlsx(file_path, out_json):
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            shared_strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                ss_content = z.read('xl/sharedStrings.xml')
                root = ET.fromstring(ss_content)
                ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for t in root.findall('.//ns:t', ns):
                    shared_strings.append(t.text)
            
            # Read sheet3
            sheet_content = z.read('xl/worksheets/sheet3.xml')
            root = ET.fromstring(sheet_content)
            ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            rows = []
            
            def col_to_idx(col_str):
                idx = 0
                for char in col_str:
                    if char.isalpha():
                        idx = idx * 26 + (ord(char.upper()) - ord('A') + 1)
                return idx - 1

            for row_elem in root.findall('.//ns:row', ns):
                row_data = [""] * 11
                for c_elem in row_elem.findall('ns:c', ns):
                    ref = c_elem.attrib.get('r', '')
                    col_letter = ''.join([char for char in ref if char.isalpha()])
                    col_idx = col_to_idx(col_letter)
                    
                    v_elem = c_elem.find('ns:v', ns)
                    val = ""
                    if v_elem is not None:
                        val = v_elem.text
                        t_attr = c_elem.attrib.get('t')
                        if t_attr == 's' and val.isdigit():
                            idx = int(val)
                            if idx < len(shared_strings):
                                val = shared_strings[idx]
                    if 0 <= col_idx < len(row_data):
                        row_data[col_idx] = val
                if any(row_data):
                    rows.append(row_data)
            
            with open(out_json, 'w', encoding='utf-8') as f:
                json.dump(rows, f, ensure_ascii=False, indent=2)
            print("Successfully extracted rows to json")
    except Exception as e:
        print(f"Error parsing: {e}")

parse_xlsx("${tempPath.replace(/\\/g, '/')}", "${TEMP_JSON.replace(/\\/g, '/')}")
`;

  const pyFile = "C:/tmp/parse_xlsx_temp.py";
  fs.writeFileSync(pyFile, pyScript, "utf8");
  execSync(`python ${pyFile}`);
  
  try {
    fs.unlinkSync(pyFile);
    fs.unlinkSync(tempPath);
  } catch (_) {}
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");

  // Extract from Excel
  extractExcelToJson();

  if (!fs.existsSync(TEMP_JSON)) throw new Error("Failed to extract rows from Excel.");
  const rawRows = JSON.parse(fs.readFileSync(TEMP_JSON, "utf8"));
  fs.unlinkSync(TEMP_JSON); // Cleanup

  // Skip header row
  const rows = rawRows.slice(1).map((row, index) => {
    return {
      manualReferenceNumber: normalizeManualRef(row[2], index + 1),
      accountName: clean(row[3]) || `Allah Rahm Account ${index + 1}`,
      bank: clean(row[4]) === "Yes",
      company: clean(row[5]) === "Yes",
      customer: clean(row[6]) === "Yes",
      lineNo: index + 2
    };
  }).filter(r => r.manualReferenceNumber);

  console.log(`Parsed ${rows.length} accounts from Excel.`);

  console.log("Connecting to database...");
  const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, idle_timeout: 1, prepare: false });
  await sql`set statement_timeout = 0`;

  // 1. Get Pakistan details
  const [pakistan] = await sql`select id, name, currency_code from countries where name ilike '%Pakistan%' and deleted_at is null limit 1`;
  if (!pakistan) throw new Error("Pakistan country not found.");
  const [mainBranch] = await sql`select id, name, code from country_branches where country_id=${pakistan.id} and deleted_at is null and (name ilike '%Pakistan%' or code ilike '%PAK%') order by created_at asc limit 1`;
  if (!mainBranch) throw new Error("Pakistan main branch not found.");

  // 2. Lookup state & district & city
  const [balochistan] = await sql`select id from states_provinces where name ilike '%Balochistan%' and deleted_at is null limit 1`;
  if (!balochistan) throw new Error("Balochistan state/province not found.");

  // Check/Insert city
  let cityId = "";
  const [existingCity] = await sql`select id from cities where name ilike '%Allah Rahm%' and deleted_at is null limit 1`;
  if (existingCity) {
    cityId = existingCity.id;
  } else {
    console.log("Creating city 'Allah Rahm'...");
    const [newCity] = await sql`
      insert into cities (name, state_province_id, country_id, created_at, updated_at)
      values ('Allah Rahm', ${balochistan.id}, ${pakistan.id}, now(), now())
      returning id
    `;
    cityId = newCity.id;
  }

  // 3. Lookup existing Chaman branch to clone settings
  const [chamanBranch] = await sql`
    select company_id, permission_grants, created_by, district_id 
    from city_branches 
    where code = 'PAK-PKBA-001' and deleted_at is null limit 1
  `;
  if (!chamanBranch) throw new Error("Chaman branch (PAK-PKBA-001) not found to copy settings.");

  // 4. Create Allah Rahm branch if not exists
  let branchId = "";
  const [existingBranch] = await sql`
    select id from city_branches 
    where code = 'PAK-PKBA-010' and deleted_at is null limit 1
  `;
  
  if (existingBranch) {
    console.log("Branch 'AR/01' already exists.");
    branchId = existingBranch.id;
  } else {
    console.log("Creating branch 'AR/01' (Allah Rahm)...");
    const [newBranch] = await sql`
      insert into city_branches (
        country_id, country_branch_id, city_name, name, code, local_currency, status,
        created_by, created_at, updated_at, state_province_id, city_id, company_id, owner_name,
        permission_template, permission_grants, district_id, contacts, documents
      ) values (
        ${pakistan.id}, ${mainBranch.id}, 'Allah Rahm', 'AR/01', 'PAK-PKBA-010', 'PKR', 'active',
        ${chamanBranch.created_by}, now(), now(), ${balochistan.id}, ${cityId}, ${chamanBranch.company_id}, 'Asmatullah',
        'city-standard', ${chamanBranch.permission_grants}, ${chamanBranch.district_id}, '[]'::jsonb, '[]'::jsonb
      ) returning id
    `;
    branchId = newBranch.id;
  }

  // 5. Query max sequences
  const [maxes] = await sql`
    select
      coalesce(max(account_serial_number),0)::bigint as max_account_serial,
      coalesce(max(branch_account_sequence) filter (where city_branch_id=${branchId}),0)::bigint as max_branch_sequence,
      coalesce(max((regexp_match(country_serial_number, '([0-9]+)$'))[1]::bigint) filter (where country_id=${pakistan.id}),0)::bigint as max_country_serial
    from enterprise_accounts
  `;

  // 6. Check existing accounts
  const refs = rows.map((row) => row.manualReferenceNumber);
  const existingAccounts = await sql`
    select manual_reference_number, name 
    from enterprise_accounts 
    where manual_reference_number in ${sql(refs)} 
      and city_branch_id=${branchId} 
      and deleted_at is null
  `;
  const existingMap = new Map(existingAccounts.map(r => [r.manual_reference_number, r.name]));
  
  const rowsToInsert = rows.filter((row) => {
    return !existingMap.has(row.manualReferenceNumber);
  });
  console.log(`Found ${rowsToInsert.length} new accounts to insert into Allah Rahm branch.`);

  let inserted = 0;
  let translations = 0;
  let branchSeq = Number(maxes.max_branch_sequence ?? 0) + 1;
  let globalSeq = Number(maxes.max_account_serial ?? 0) + 1;
  let countrySeq = Number(maxes.max_country_serial ?? 0) + 1;

  console.log("Inserting records...");
  await sql.begin(async (tx) => {
    for (const row of rowsToInsert) {
      const code = `PK-ALR-AC-${String(branchSeq).padStart(6, "0")}`;
      const customerNumber = `CUST-${code}`;
      const countrySerialNumber = `PAK-${String(countrySeq).padStart(6, "0")}`;
      const branchSerialNumber = `PAK-ALR-${String(branchSeq).padStart(6, "0")}`;
      const kind = accountKind(row.accountName);

      const contacts = {
        importedFrom: XLSX_PATH,
        sourceLine: row.lineNo,
        sourceBranch: "Allah Rahm",
        legacyReference: row.manualReferenceNumber,
        isBankAccount: row.bank,
        isCompany: row.company,
        isCustomer: row.customer
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
          'city_branch', ${pakistan.id}, ${mainBranch.id}, ${branchId},
          ${code}, ${code}, ${customerNumber}, ${globalSeq},
          ${countrySerialNumber}, ${branchSerialNumber}, ${row.manualReferenceNumber},
          now(), 'PAK-PKBA-010', ${branchSeq},
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
          'city_branch', ${pakistan.id}, ${mainBranch.id}, ${branchId},
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
          ${JSON.stringify({ ...contacts, customerNumber, accountSerialNumber: globalSeq, countrySerialNumber, branchSerialNumber, manualReferenceNumber: row.manualReferenceNumber, branchCode: 'PAK-PKBA-010', branchAccountSequence: branchSeq, linkedLedgerId: ledger.id })}::jsonb
        )
      `;

      translations += await upsertTranslation(tx, account.id, "name", row.accountName);

      inserted += 1;
      branchSeq += 1;
      globalSeq += 1;
      countrySeq += 1;
    }
  });

  await sql.end();
  console.log(`Import completed successfully. Inserted: ${inserted} accounts. Translations: ${translations}.`);
}

main().catch(err => {
  console.error("Migration failed:", err);
});
