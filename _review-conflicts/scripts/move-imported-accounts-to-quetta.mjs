import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

function clean(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "0" || text.toLowerCase() === "nil") return null;
  return text;
}

function normalizeManualRef(value, fallbackIndex) {
  const raw = clean(value) ?? `LEGACY-${fallbackIndex}`;
  return raw.replace(/\s+/g, "-").toUpperCase().slice(0, 80);
}

function parseManualRefs() {
  const lines = fs.readFileSync(SOURCE, "utf8").split(/\r?\n/).filter(Boolean);
  lines.shift();
  const seen = new Map();
  return lines.map((line, index) => {
    const ref = normalizeManualRef(line.split("\t")[0], index + 1);
    const count = seen.get(ref) ?? 0;
    seen.set(ref, count + 1);
    return count ? `${ref}-${count + 1}` : ref;
  });
}

async function resolveTarget(supabase) {
  const { data: country, error: countryError } = await supabase
    .from("countries")
    .select("id,name,currency_code")
    .ilike("name", "%Pakistan%")
    .single();
  if (countryError) throw new Error(countryError.message);

  const { data: mainBranch, error: mainBranchError } = await supabase
    .from("country_branches")
    .select("id,name,code")
    .eq("country_id", country.id)
    .ilike("name", "%Pakistan%")
    .single();
  if (mainBranchError) throw new Error(mainBranchError.message);

  const { data: quettaBranch, error: quettaError } = await supabase
    .from("city_branches")
    .select("id,name,code,city_name")
    .eq("country_id", country.id)
    .eq("country_branch_id", mainBranch.id)
    .or("city_name.ilike.%Quetta%,name.ilike.%Quetta%,code.ilike.%QTA%")
    .single();
  if (quettaError) throw new Error(quettaError.message);

  return {
    countryId: country.id,
    countryName: country.name,
    currency: country.currency_code ?? "PKR",
    countryBranchId: mainBranch.id,
    countryBranchName: mainBranch.name,
    cityBranchId: quettaBranch.id,
    cityBranchName: quettaBranch.name ?? quettaBranch.city_name,
    cityBranchCode: quettaBranch.code ?? "PAK-QTA",
    branchSerialPrefix: "PAK-QTA",
    accountPrefix: "PK-QTA-AC"
  };
}

async function existingCodeSet(supabase, target) {
  const { data, error } = await supabase
    .from("enterprise_accounts")
    .select("code")
    .eq("scope", "city_branch")
    .eq("country_id", target.countryId)
    .eq("country_branch_id", target.countryBranchId)
    .eq("city_branch_id", target.cityBranchId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.code).filter(Boolean));
}

function nextFreeCode(usedCodes, prefix, start) {
  let sequence = start;
  while (sequence < 1000000) {
    const code = `${prefix}-${String(sequence).padStart(6, "0")}`;
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return { code, sequence };
    }
    sequence += 1;
  }
  throw new Error("No free Quetta account code is available.");
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error("Supabase URL/service key missing.");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const target = await resolveTarget(supabase);
  const manualRefs = parseManualRefs();
  const dryRun = !process.argv.includes("--apply");

  const { data: accounts, error: accountsError } = await supabase
    .from("enterprise_accounts")
    .select("id, code, account_number, manual_reference_number, account_serial_number, country_serial_number, name")
    .in("manual_reference_number", manualRefs)
    .order("created_at", { ascending: true });
  if (accountsError) throw new Error(accountsError.message);

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "apply",
        sourceRefs: manualRefs.length,
        matchedAccounts: accounts?.length ?? 0,
        target
      },
      null,
      2
    )
  );

  if (dryRun) return;

  const usedCodes = await existingCodeSet(supabase, target);
  let start = usedCodes.size + 1;
  let moved = 0;
  const movedSample = [];

  for (const account of accounts ?? []) {
    const { code, sequence } = nextFreeCode(usedCodes, target.accountPrefix, start);
    start = sequence + 1;
    const customerNumber = `CUST-${code}`;
    const branchSerialNumber = `${target.branchSerialPrefix}-${String(sequence).padStart(6, "0")}`;

    const { error: accountError } = await supabase
      .from("enterprise_accounts")
      .update({
        scope: "city_branch",
        country_id: target.countryId,
        country_branch_id: target.countryBranchId,
        city_branch_id: target.cityBranchId,
        code,
        account_number: code,
        customer_number: customerNumber,
        branch_code: target.cityBranchCode,
        branch_serial_number: branchSerialNumber,
        branch_account_sequence: sequence,
        currency: target.currency,
        updated_at: new Date().toISOString()
      })
      .eq("id", account.id);
    if (accountError) throw new Error(`${account.manual_reference_number}: ${accountError.message}`);

    const { error: ledgerError } = await supabase
      .from("ledgers")
      .update({
        scope: "city_branch",
        country_id: target.countryId,
        country_branch_id: target.countryBranchId,
        city_branch_id: target.cityBranchId,
        code,
        currency: target.currency,
        updated_at: new Date().toISOString()
      })
      .eq("enterprise_account_id", account.id);
    if (ledgerError) throw new Error(`${account.manual_reference_number}: ${ledgerError.message}`);

    const { error: historyError } = await supabase
      .from("enterprise_account_history")
      .update({
        account_number: code,
        details: {
          movedToBranch: "Quetta",
          previousAccountNumber: account.account_number,
          previousCode: account.code,
          customerNumber,
          countrySerialNumber: account.country_serial_number,
          branchSerialNumber,
          manualReferenceNumber: account.manual_reference_number,
          branchCode: target.cityBranchCode,
          branchAccountSequence: sequence
        }
      })
      .eq("enterprise_account_id", account.id);
    if (historyError) throw new Error(`${account.manual_reference_number}: ${historyError.message}`);

    moved += 1;
    if (movedSample.length < 10) {
      movedSample.push({
        manualReference: account.manual_reference_number,
        oldAccountNumber: account.account_number,
        newAccountNumber: code,
        name: account.name
      });
    }
  }

  const [chamanCount, quettaCount, quettaLedgers] = await Promise.all([
    supabase
      .from("enterprise_accounts")
      .select("id", { count: "exact", head: true })
      .eq("city_branch_id", "18ca382f-928c-42bf-9c4a-4db301679e8b")
      .in("manual_reference_number", manualRefs)
      .is("deleted_at", null),
    supabase
      .from("enterprise_accounts")
      .select("id", { count: "exact", head: true })
      .eq("city_branch_id", target.cityBranchId)
      .in("manual_reference_number", manualRefs)
      .is("deleted_at", null),
    supabase
      .from("ledgers")
      .select("id", { count: "exact", head: true })
      .eq("city_branch_id", target.cityBranchId)
      .is("deleted_at", null)
  ]);

  for (const result of [chamanCount, quettaCount, quettaLedgers]) {
    if (result.error) throw new Error(result.error.message);
  }

  console.log(
    JSON.stringify(
      {
        moved,
        importedRefsStillInChaman: chamanCount.count,
        importedRefsNowInQuetta: quettaCount.count,
        quettaLedgerRowsTotal: quettaLedgers.count,
        movedSample
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
