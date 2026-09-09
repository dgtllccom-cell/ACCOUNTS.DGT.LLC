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
  const updated = await sql`
    UPDATE countries 
    SET deleted_at = NOW() 
    WHERE id = '2cb131ca-6752-49de-aa9e-1d032e01e6d5' OR (iso2 = '92' AND name = 'Pakstan')
    RETURNING id, name, iso2
  `;
  console.log("Cleaned rogue country rows:", updated);
  await sql.end();
}

main().catch(console.error);
