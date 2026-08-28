import postgres from 'postgres';
import fs from 'fs';

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
const sql = postgres(dbUrl, { max: 2, prepare: false });

async function findUserTables() {
  const tables = await sql`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_schema IN ('public', 'auth') 
      AND (table_name ILIKE '%user%' OR table_name ILIKE '%auth%' OR table_name ILIKE '%account%' OR table_name ILIKE '%employee%' OR table_name ILIKE '%member%')
    ORDER BY table_schema, table_name;
  `;
  console.log("=== User/Auth tables in Database ===", tables);

  // Check auth.users if Supabase
  try {
    const authUsers = await sql`SELECT count(*) FROM auth.users;`;
    console.log("Count in auth.users:", authUsers);
  } catch (e) {
    console.log("No auth.users:", e.message);
  }

  // Check public tables
  for (const t of tables) {
    if (t.table_schema === 'public') {
      try {
        const count = await sql`SELECT count(*) FROM ${sql(t.table_name)};`;
        console.log(`Count in public.${t.table_name}:`, count[0].count);
      } catch (e) {
        console.log(`Error counting public.${t.table_name}:`, e.message);
      }
    }
  }

  await sql.end();
}

findUserTables().catch(console.error);
