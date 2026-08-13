import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const TARGET_REF = "csesvyxxjivnkkozgopt";
const PROD_REF = "inmayhrxucimxqhgseqi";

function parseArgs(argv) {
  return {
    confirmLocalDev: argv.includes("--confirm-local-dev"),
    sourceTag:
      argv.find((arg) => arg.startsWith("--source-tag="))?.split("=")[1]?.trim() || null
  };
}

async function loadEnvFile(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function extractSupabaseRef(url) {
  if (!url) return null;
  const match = String(url).match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?/i);
  return match?.[1] ?? null;
}

async function main() {
  await loadEnvFile(path.join(process.cwd(), ".env.local"));
  await loadEnvFile(path.join(process.cwd(), ".env"));
  const args = parseArgs(process.argv.slice(2));
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const rawDbUrl = process.env.DATABASE_URL || "";
  const ref = extractSupabaseRef(rawUrl);
  const prodRef = process.env.PROD_SUPABASE_REF?.trim() || PROD_REF;
  if (!args.confirmLocalDev) throw new Error("Missing --confirm-local-dev.");
  if (!args.sourceTag) throw new Error("Missing --source-tag.");
  if (ref !== TARGET_REF) throw new Error(`Supabase ref mismatch: expected ${TARGET_REF}, got ${ref ?? "null"}.`);
  if (ref === prodRef || rawUrl.includes(prodRef) || rawDbUrl.includes(prodRef)) {
    throw new Error(`Ref ${ref} matches production ref ${prodRef}; refusing to proceed.`);
  }
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production") {
    throw new Error("Refusing to run in a production-like NODE_ENV/APP_ENV.");
  }
  if (!rawDbUrl.includes(TARGET_REF)) {
    throw new Error("DATABASE_URL does not point at the authorized dev project ref.");
  }

  const sql = postgres(rawDbUrl, { max: 4, prepare: false, connect_timeout: 30 });
  const sourceTag = args.sourceTag;
  const branchCodes = [
    "DEV-AE-TEST-DUBAI-001",
    "DEV-PK-TEST-KARACHI-001",
    "DEV-PK-TEST-QUETTA-001",
    "DEV-AF-TEST-KABUL-001",
    "DEV-IN-TEST-MUMBAI-001"
  ];
  const branchEmails = [
    "devtest.dubai.test@dgt.llc",
    "devtest.karachi.test@dgt.llc",
    "devtest.quetta.test@dgt.llc",
    "devtest.kabul.test@dgt.llc",
    "devtest.mumbai.test@dgt.llc",
    "devtest.uae.main.admin@dgt.llc"
  ];

  console.log(`Cleaning DEV TEST master data for source tag ${sourceTag}...`);

  const accountLike = `${sourceTag}-%`;
  const branchEmailLike = branchEmails;
  await sql.begin(async (tx) => {
    await tx`DELETE FROM employees WHERE employee_code LIKE ${accountLike}`;
    await tx`DELETE FROM enterprise_accounts WHERE manual_reference_number LIKE ${accountLike} OR account_number LIKE ${accountLike}`;
    await tx`DELETE FROM warehouses WHERE description = ${sourceTag} OR warehouse_code LIKE ${accountLike}`;
    await tx`DELETE FROM customers WHERE notes = ${sourceTag} OR customer_name LIKE ${accountLike}`;
    await tx`DELETE FROM banks WHERE remarks = ${sourceTag} OR bank_name LIKE ${accountLike}`;
    await tx`DELETE FROM companies WHERE name LIKE ${accountLike}`;
    await tx`DELETE FROM user_role_assignments WHERE user_id IN (SELECT id FROM auth.users WHERE email = ANY(${branchEmailLike}))`;
    await tx`DELETE FROM profiles WHERE id IN (SELECT id FROM auth.users WHERE email = ANY(${branchEmailLike}))`;
    await tx`DELETE FROM auth.users WHERE email = ANY(${branchEmailLike})`;
    await tx`DELETE FROM city_branches WHERE code = ANY(${branchCodes})`;
  });

  console.log("Cleanup completed.");
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error("[DEV TEST CLEANUP] Failed:", err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exitCode = 1;
});
