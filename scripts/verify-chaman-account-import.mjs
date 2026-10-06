import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SOURCE =
  "C:/Users/dgtll/.codex/attachments/87971062-af23-48fb-bf24-199d3a14f214/pasted-text.txt";

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

function clean(value) {
  const text = String(value ?? "").trim();
  if (!text || text === "0" || text.toLowerCase() === "nil") return null;
  return text;
}

function normalizeManualRef(value, fallbackIndex) {
  const raw = clean(value) ?? `LEGACY-${fallbackIndex}`;
  return raw.replace(/\s+/g, "-").toUpperCase().slice(0, 80);
}

const lines = fs.readFileSync(SOURCE, "utf8").split(/\r?\n/).filter(Boolean);
lines.shift();
const seen = new Map();
const manualRefs = lines.map((line, index) => {
  const ref = normalizeManualRef(line.split("\t")[0], index + 1);
  const count = seen.get(ref) ?? 0;
  seen.set(ref, count + 1);
  return count ? `${ref}-${count + 1}` : ref;
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false }
});

const countryId = "7b757efe-7aea-4e9e-9cc4-34b2e842958f";
const countryBranchId = "a7a7f280-825b-4fdd-8205-78e224a17100";
const cityBranchId = "18ca382f-928c-42bf-9c4a-4db301679e8b";

const [
  importedAccounts,
  targetAccounts,
  targetLedgers,
  importedLedgerRows,
  historyRows,
  sampleRows
] = await Promise.all([
  supabase
    .from("enterprise_accounts")
    .select("id", { count: "exact", head: true })
    .in("manual_reference_number", manualRefs),
  supabase
    .from("enterprise_accounts")
    .select("id", { count: "exact", head: true })
    .eq("country_id", countryId)
    .eq("country_branch_id", countryBranchId)
    .eq("city_branch_id", cityBranchId)
    .is("deleted_at", null),
  supabase
    .from("ledgers")
    .select("id", { count: "exact", head: true })
    .eq("country_id", countryId)
    .eq("country_branch_id", countryBranchId)
    .eq("city_branch_id", cityBranchId)
    .is("deleted_at", null),
  supabase
    .from("ledgers")
    .select("id, enterprise_account_id", { count: "exact" })
    .eq("country_id", countryId)
    .eq("country_branch_id", countryBranchId)
    .eq("city_branch_id", cityBranchId)
    .not("enterprise_account_id", "is", null)
    .is("deleted_at", null)
    .limit(1),
  supabase
    .from("enterprise_account_history")
    .select("id", { count: "exact", head: true }),
  supabase
    .from("enterprise_accounts")
    .select("account_number, manual_reference_number, customer_number, name, currency, branch_code, country_serial_number, branch_serial_number")
    .in("manual_reference_number", manualRefs.slice(0, 5))
    .order("account_number", { ascending: true })
]);

for (const result of [importedAccounts, targetAccounts, targetLedgers, importedLedgerRows, historyRows, sampleRows]) {
  if (result.error) throw new Error(result.error.message);
}

console.log(
  JSON.stringify(
    {
      sourceRows: manualRefs.length,
      importedAccountRowsMatchedByManualRef: importedAccounts.count,
      chamanAccountRowsTotal: targetAccounts.count,
      chamanLedgerRowsTotal: targetLedgers.count,
      chamanLedgersLinkedToAccounts: importedLedgerRows.count,
      enterpriseAccountHistoryRowsTotal: historyRows.count,
      sampleAccounts: sampleRows.data
    },
    null,
    2
  )
);
