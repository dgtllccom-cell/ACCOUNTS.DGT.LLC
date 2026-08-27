import postgres from "postgres";
import fs from "fs";

function loadEnv() {
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        process.env.DATABASE_URL = line.slice(line.indexOf("=") + 1).trim();
      }
    }
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const sql = postgres(dbUrl, { max: 5 });

async function main() {
  try {
    const r = await sql`SELECT * FROM enterprise_accounts WHERE code = 'UAE-DUB-AC-0003' OR code ILIKE '%0003%'`;
    console.log("Local 0003 Account:", r);
  } catch (e) {
    console.error("Err:", e.message);
  } finally {
    await sql.end();
  }
}

main();
