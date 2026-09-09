import postgres from "postgres";
import fs from "fs";

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (fs.existsSync(".env.local")) {
    const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith("DATABASE_URL=")) {
        return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }
  return null;
}

async function main() {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    console.error("No DATABASE_URL found");
    return;
  }
  const sql = postgres(dbUrl, { max: 1 });
  const rows = await sql`
    SELECT id, code, name, country_id, is_system, deleted_at 
    FROM ledgers 
    WHERE code LIKE '%92%' OR name LIKE '%Pakstan%' OR country_id = '2cb131ca-6752-49de-aa9e-1d032e01e6d5'
  `;
  console.log("Rogue ledgers found:", rows);

  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const deleted = await sql`
      UPDATE ledgers 
      SET deleted_at = NOW(), is_active = false 
      WHERE id IN ${sql(ids)}
      RETURNING id, code, name
    `;
    console.log("Cleaned rogue ledgers:", deleted);
  }

  // Also check accounts table
  const accs = await sql`
    SELECT id, code, name, country_id, deleted_at 
    FROM accounts 
    WHERE code LIKE '%92%' OR name LIKE '%Pakstan%' OR country_id = '2cb131ca-6752-49de-aa9e-1d032e01e6d5'
  `;
  console.log("Rogue accounts found:", accs);
  if (accs.length > 0) {
    const accIds = accs.map((r) => r.id);
    const delAcc = await sql`
      UPDATE accounts 
      SET deleted_at = NOW() 
      WHERE id IN ${sql(accIds)}
      RETURNING id, code, name
    `;
    console.log("Cleaned rogue accounts:", delAcc);
  }

  await sql.end();
}

main().catch(console.error);
