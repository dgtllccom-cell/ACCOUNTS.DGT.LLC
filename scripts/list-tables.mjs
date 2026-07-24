import fs from "node:fs";
import postgres from "postgres";

function loadEnvLocal() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });

async function listTables() {
  try {
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;
    console.log(tables.map(t => t.tablename).join(", "));
  } catch(e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}

listTables();
