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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function refAt(line, fallbackIndex) {
  const raw = String(line.split("\t")[0] ?? "").trim() || `LEGACY-${fallbackIndex}`;
  return raw.replace(/\s+/g, "-").toUpperCase().slice(0, 80);
}

const lines = fs.readFileSync(SOURCE, "utf8").split(/\r?\n/).filter(Boolean);
lines.shift();
const seen = new Map();
const refs = lines.map((line, index) => {
  const ref = refAt(line, index + 1);
  const count = seen.get(ref) ?? 0;
  seen.set(ref, count + 1);
  return count ? `${ref}-${count + 1}` : ref;
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false }
});

const chamanId = "18ca382f-928c-42bf-9c4a-4db301679e8b";
const quettaId = "ea9bcd98-3a85-463c-89f2-0561f13208b0";

const [allImported, inChaman, inQuetta, quettaLedgers, sample] = await Promise.all([
  supabase.from("enterprise_accounts").select("id", { count: "exact", head: true }).in("manual_reference_number", refs).is("deleted_at", null),
  supabase.from("enterprise_accounts").select("id", { count: "exact", head: true }).in("manual_reference_number", refs).eq("city_branch_id", chamanId).is("deleted_at", null),
  supabase.from("enterprise_accounts").select("id", { count: "exact", head: true }).in("manual_reference_number", refs).eq("city_branch_id", quettaId).is("deleted_at", null),
  supabase.from("ledgers").select("id", { count: "exact", head: true }).eq("city_branch_id", quettaId).not("enterprise_account_id", "is", null).is("deleted_at", null),
  supabase
    .from("enterprise_accounts")
    .select("account_number, manual_reference_number, customer_number, name, branch_code, branch_serial_number, currency")
    .in("manual_reference_number", refs.slice(0, 5))
    .eq("city_branch_id", quettaId)
    .order("account_number", { ascending: true })
]);

for (const result of [allImported, inChaman, inQuetta, quettaLedgers, sample]) {
  if (result.error) throw new Error(result.error.message);
}

console.log(
  JSON.stringify(
    {
      sourceRefs: refs.length,
      importedAccountsTotal: allImported.count,
      importedAccountsStillInChaman: inChaman.count,
      importedAccountsInQuetta: inQuetta.count,
      quettaLinkedLedgersTotal: quettaLedgers.count,
      sample: sample.data
    },
    null,
    2
  )
);
