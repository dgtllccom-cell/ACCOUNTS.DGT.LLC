import { execSync } from "child_process";
import fs from "fs";

const SERVER = "root@72.60.209.121";

const auditScript = `
import postgres from "postgres";
import fs from "fs";

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
let dbUrl = "";
for (const line of envContent.split("\\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^[\\"\\']/, "").replace(/[\\"\\']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 15 });

async function run() {
  console.log("=== CHECKING SEQUENCES IN DATABASE ===");
  try {
    const vSeqs = await sql\`SELECT * FROM public.voucher_sequences\`;
    console.log("Voucher sequences (" + vSeqs.length + "):", vSeqs);
  } catch (e) {
    console.log("voucher_sequences check:", e.message);
  }

  console.log("\\n=== CHECKING ROZNAMCHA TEST ENTRIES ===");
  try {
    const rozEntries = await sql\`SELECT id, serial_number, entry_date, description, total_amount, status FROM public.roznamcha_entries\`;
    console.log("Roznamcha entries:", rozEntries);
  } catch (e) {
    console.log("roznamcha_entries check:", e.message);
  }

  console.log("\\n=== CHECKING DOCUMENT INTAKE TEST JOBS ===");
  try {
    const jobs = await sql\`SELECT id, job_number, file_name, file_url, storage_path, status FROM public.document_intake_jobs\`;
    console.log("Document jobs:", jobs);
  } catch (e) {
    console.log("document_intake_jobs check:", e.message);
  }

  console.log("\\n=== CHECKING ENTERPRISE ACCOUNTS ===");
  try {
    const accs = await sql\`SELECT id, account_name, account_number, country_id, currency, is_active FROM public.enterprise_accounts\`;
    console.log("Enterprise accounts (" + accs.length + "):", accs);
  } catch (e) {
    console.log("enterprise_accounts check:", e.message);
  }

  console.log("\\n=== CHECKING BACKUP DIRECTORY ON VPS ===");
  if (!fs.existsSync("/var/www/dgt-nextjs/backups")) {
    fs.mkdirSync("/var/www/dgt-nextjs/backups", { recursive: true });
    console.log("Created /var/www/dgt-nextjs/backups");
  } else {
    console.log("Existing backups:", fs.readdirSync("/var/www/dgt-nextjs/backups"));
  }

  await sql.end();
}

run().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
`;

fs.writeFileSync("scripts/audit_eps_details2.mjs", auditScript);

try {
  execSync(`scp -o StrictHostKeyChecking=no scripts/audit_eps_details2.mjs ${SERVER}:/var/www/dgt-nextjs/audit_eps_details2.mjs`, { stdio: "inherit" });
  execSync(`ssh -o StrictHostKeyChecking=no ${SERVER} "cd /var/www/dgt-nextjs && node audit_eps_details2.mjs && rm -f audit_eps_details2.mjs"`, { stdio: "inherit" });
} catch (e) {
  console.error("Execution failed:", e.message);
} finally {
  if (fs.existsSync("scripts/audit_eps_details2.mjs")) {
    fs.unlinkSync("scripts/audit_eps_details2.mjs");
  }
}
