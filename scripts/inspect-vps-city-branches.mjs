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

const sql = postgres(process.env.DATABASE_URL, { max: 2 });

async function run() {
  const cit = await sql`
    SELECT id, name, code, city_name, country_id, status, deleted_at 
    FROM city_branches 
    WHERE country_id IN ('ace69ef9-8c3b-479c-bdb7-7953ddf8629d', '582526d0-0375-41e9-8eba-ccbd2a5e3a0f');
  `;
  console.log("=== PK and UAE CITY BRANCHES ON VPS ===");
  console.table(cit);

  const allCit = await sql`SELECT id, name, code, city_name, country_id, status, deleted_at FROM city_branches;`;
  console.log("=== ALL CITY BRANCHES ON VPS ===");
  console.table(allCit);

  await sql.end();
}

run().catch(console.error);
