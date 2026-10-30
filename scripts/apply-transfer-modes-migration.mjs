import fs from "fs";
import postgres from "postgres";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) throw new Error(".env.local not found");
const env = fs.readFileSync(envPath, "utf8");

const m = env.match(/^DATABASE_URL\s*=\s*(.+)$/m);
if (!m) throw new Error("No DATABASE_URL found in .env.local");
const dbUrl = m[1].trim().replace(/^['"]|['"]$/g, "");

// Safety check: ensure testing environment
console.log("Checking DB target...");
if (!dbUrl.includes("csesvyxxjivnkkozgopt")) {
  throw new Error("ABORT: Target is NOT testing database csesvyxxjivnkkozgopt! Current URL does not match testing ref.");
}

console.log("Confirmed: Target is Testing DB csesvyxxjivnkkozgopt.");

const sql = postgres(dbUrl, { ssl: "require" });

async function run() {
  try {
    const migPath = path.resolve(process.cwd(), "supabase/migrations/20261244_create_transfer_modes_master.sql");
    const migrationSql = fs.readFileSync(migPath, "utf8");
    console.log("Applying 20261244_create_transfer_modes_master.sql...");
    await sql.unsafe(migrationSql);
    console.log("Migration executed successfully!");

    const rows = await sql`SELECT id, code, name, reference_label, sort_order FROM public.transfer_modes ORDER BY sort_order;`;
    console.log("Active transfer modes:", rows);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
