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
    const portCols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ports'
    `;
    console.log("Columns for ports table:", portCols);
    const existingPorts = await sql`SELECT * FROM ports LIMIT 10`;
    console.log("Sample existing ports:", existingPorts);

    const countries = await sql`SELECT id, name, iso2, iso3 FROM countries ORDER BY name ASC`;
    console.log("Countries count:", countries.length, countries.slice(0, 10));
  } catch (e) {
    console.error("Err:", e.message);
  } finally {
    await sql.end();
  }
}

main();
