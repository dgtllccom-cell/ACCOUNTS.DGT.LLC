import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const SOURCE =
  "C:/Users/dgtll/.codex/attachments/87971062-af23-48fb-bf24-199d3a14f214/pasted-text.txt";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
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

function normalizeManualRef(value, fallbackIndex) {
  const raw = clean(value) ?? `LEGACY-${fallbackIndex}`;
  return raw.replace(/\s+/g, "-").toUpperCase().slice(0, 80);
}

function accountKind(category, businessName) {
  const value = `${category ?? ""} ${businessName ?? ""}`.toLowerCase();
  if (["u", "kch"].includes(String(category ?? "").toLowerCase())) return "expense";
  if (["s", "2as"].includes(String(category ?? "").toLowerCase())) return "liability";
  if (value.includes("income") || value.includes("tax")) return "income";
  return "asset";
}

function parseRows() {
  const lines = fs.readFileSync(SOURCE, "utf8").split(/\r?\n/).filter(Boolean);
  lines.shift();
  const rows = lines
    .map((line, index) => {
      const cols = line.split("\t");
      return {
        legacyRef: normalizeManualRef(cols[0], index + 1),
        category: clean(cols[1]),
        sourceBranch: clean(cols[2]),
        accountName: clean(cols[3]) ?? `Imported Account ${index + 1}`,
        companyName: clean(cols[4]),
        businessName: clean(cols[5]),
        city: clean(cols[6]),
        address: clean(cols[7]),
        mobile: clean(cols[8]),
        whatsapp: clean(cols[9]),
        phone: clean(cols[10]),
        email: clean(cols[11]),
        lineNo: index + 2
      };
    })
    .filter((row) => row.accountName);

  const seen = new Map();
  return rows.map((row) => {
    const count = seen.get(row.legacyRef) ?? 0;
    seen.set(row.legacyRef, count + 1);
    return {
      ...row,
      manualReferenceNumber: count ? `${row.legacyRef}-${count + 1}` : row.legacyRef
    };
  });
}
async function nextCode(supabase, cityBranchId) {
  const { count, error } = await supabase
    .from("enterprise_accounts")
    .select("id", { count: "exact", head: true })
    .eq("city_branch_id", cityBranchId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  let next = Number(count ?? 0) + 1;
  while (next < 1000000) {
    const code = `PK-CHM-AC-${String(next).padStart(6, "0")}`;
    const { data: existing, error: existingError } = await supabase
      .from("enterprise_accounts")
      .select("id")
      .eq("scope", "city_branch")
      .eq("country_id", IDS.countryId)
      .eq("country_branch_id", IDS.countryBranchId)
      .eq("city_branch_id", cityBranchId)
      .eq("code", code)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) return code;
    next += 1;
  }
  throw new Error("Could not generate a free Chaman account code.");
}

async function nextIdentity(supabase, cityBranchId, accountCode) {
  const [{ count: totalCount, error: totalError }, { count: countryCount, error: countryError }, { count: branchCount, error: branchError }] =
    await Promise.all([
      supabase.from("enterprise_accounts").select("id", { count: "exact", head: true }),
      supabase
        .from("enterprise_accounts")
        .select("id", { count: "exact", head: true })
        .eq("country_id", IDS.countryId)
        .not("manual_reference_number", "is", null)
        .is("deleted_at", null),
      supabase
        .from("enterprise_accounts")
        .select("id", { count: "exact", head: true })
        .eq("scope", "city_branch")
        .eq("country_id", IDS.countryId)
        .eq("country_branch_id", IDS.countryBranchId)
        .eq("city_branch_id", cityBranchId)
        .not("manual_reference_number", "is", null)
        .is("deleted_at", null)
    ]);
  if (totalError) throw new Error(totalError.message);
  if (countryError) throw new Error(countryError.message);
  if (branchError) throw new Error(branchError.message);
  const branchSeq = Number(branchCount ?? 0) + 1;
  return {
    accountNumber: accountCode,
    customerNumber: `CUST-${accountCode}`,
    accountSerialNumber: Number(totalCount ?? 0) + 1,
    countrySerialNumber: `PAK-${String(Number(countryCount ?? 0) + 1).padStart(6, "0")}`,
    branchSerialNumber: `PAK-CHM-${String(branchSeq).padStart(6, "0")}`,
    branchCode: IDS.cityBranchCode,
    branchAccountSequence: branchSeq
  };
}

let IDS = {};

async function resolveScope(supabase) {
  const { data: country, error: countryError } = await supabase
    .from("countries")
    .select("id,name,iso2,currency_code")
    .ilike("name", "%Pakistan%")
    .limit(1)
    .single();
  if (countryError) throw new Error(`Pakistan country not found: ${countryError.message}`);

  const { data: branch, error: branchError } = await supabase
    .from("country_branches")
    .select("id,name,code,country_id")
    .eq("country_id", country.id)
    .or("name.ilike.%Pakistan%,code.ilike.%PAK%")
    .limit(1)
    .single();
  if (branchError) throw new Error(`Pakistan main branch not found: ${branchError.message}`);

  const { data: city, error: cityError } = await supabase
    .from("city_branches")
    .select("id,name,code,city_name,country_id,country_branch_id")
    .eq("country_id", country.id)
    .eq("country_branch_id", branch.id)
    .or("city_name.ilike.%CHAMAN%,name.ilike.%CHAMAN%,code.ilike.%CHM%,code.ilike.%CH%")
    .limit(1)
    .single();
  if (cityError) throw new Error(`CHAMAN city branch not found: ${cityError.message}`);

  IDS = {
    countryId: country.id,
    countryName: country.name,
    currency: country.currency_code ?? "PKR",
    countryBranchId: branch.id,
    countryBranchName: branch.name,
    cityBranchId: city.id,
    cityBranchName: city.name ?? city.city_name,
    cityBranchCode: city.code ?? "PAK-CHM"
  };
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase URL/service role key is missing.");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  await resolveScope(supabase);
  const rows = parseRows();
  const dryRun = !process.argv.includes("--apply");

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "apply",
        sourceRows: rows.length,
        target: IDS,
        sample: rows.slice(0, 3)
      },
      null,
      2
    )
  );

  if (dryRun) return;

  let inserted = 0;
  let skipped = 0;
  const insertedRefs = [];

  for (const row of rows) {
    const { data: existing, error: existingError } = await supabase
      .from("enterprise_accounts")
      .select("id")
      .eq("manual_reference_number", row.manualReferenceNumber)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      skipped += 1;
      continue;
    }

    const code = await nextCode(supabase, IDS.cityBranchId);
    const identity = await nextIdentity(supabase, IDS.cityBranchId, code);
    const contacts = {
      importedFrom: "legacy-pasted-text",
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

    const { data: account, error: accountError } = await supabase
      .from("enterprise_accounts")
      .insert({
        scope: "city_branch",
        country_id: IDS.countryId,
        country_branch_id: IDS.countryBranchId,
        city_branch_id: IDS.cityBranchId,
        code,
        account_number: identity.accountNumber,
        customer_number: identity.customerNumber,
        account_serial_number: identity.accountSerialNumber,
        country_serial_number: identity.countrySerialNumber,
        branch_serial_number: identity.branchSerialNumber,
        manual_reference_number: row.manualReferenceNumber,
        creation_date: new Date().toISOString(),
        branch_code: identity.branchCode,
        branch_account_sequence: identity.branchAccountSequence,
        name: row.accountName,
        kind: accountKind(row.category, row.businessName),
        currency: IDS.currency,
        opening_balance: 0,
        current_balance: 0,
        status: "active",
        is_control_account: false,
        contacts
      })
      .select("id")
      .single();
    if (accountError) throw new Error(`${row.manualReferenceNumber}: ${accountError.message}`);

    const creditNormal = accountKind(row.category, row.businessName) === "liability" || accountKind(row.category, row.businessName) === "income";
    const { data: ledger, error: ledgerError } = await supabase
      .from("ledgers")
      .insert({
        scope: "city_branch",
        country_id: IDS.countryId,
        country_branch_id: IDS.countryBranchId,
        city_branch_id: IDS.cityBranchId,
        enterprise_account_id: account.id,
        code,
        name: row.accountName,
        currency: IDS.currency,
        opening_balance: 0,
        current_balance: 0,
        debit_total: 0,
        credit_total: 0,
        normal_balance: creditNormal ? "credit" : "debit",
        is_active: true
      })
      .select("id")
      .single();
    if (ledgerError) throw new Error(`${row.manualReferenceNumber}: ${ledgerError.message}`);

    const { error: historyError } = await supabase.from("enterprise_account_history").insert({
      enterprise_account_id: account.id,
      account_number: identity.accountNumber,
      event_type: "created",
      debit_total: 0,
      credit_total: 0,
      current_balance: 0,
      details: {
        ...contacts,
        customerNumber: identity.customerNumber,
        accountSerialNumber: identity.accountSerialNumber,
        countrySerialNumber: identity.countrySerialNumber,
        branchSerialNumber: identity.branchSerialNumber,
        manualReferenceNumber: row.manualReferenceNumber,
        branchCode: identity.branchCode,
        branchAccountSequence: identity.branchAccountSequence,
        linkedLedgerId: ledger.id
      }
    });
    if (historyError) throw new Error(`${row.manualReferenceNumber}: ${historyError.message}`);

    inserted += 1;
    insertedRefs.push({
      manualReference: row.manualReferenceNumber,
      accountNumber: identity.accountNumber,
      name: row.accountName
    });
  }

  const [{ count: accountCount }, { count: ledgerCount }] = await Promise.all([
    supabase
      .from("enterprise_accounts")
      .select("id", { count: "exact", head: true })
      .eq("country_id", IDS.countryId)
      .eq("country_branch_id", IDS.countryBranchId)
      .eq("city_branch_id", IDS.cityBranchId)
      .is("deleted_at", null),
    supabase
      .from("ledgers")
      .select("id", { count: "exact", head: true })
      .eq("country_id", IDS.countryId)
      .eq("country_branch_id", IDS.countryBranchId)
      .eq("city_branch_id", IDS.cityBranchId)
      .is("deleted_at", null)
  ]);

  console.log(
    JSON.stringify(
      {
        inserted,
        skipped,
        targetAccountCount: accountCount,
        targetLedgerCount: ledgerCount,
        insertedSample: insertedRefs.slice(0, 10)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});




