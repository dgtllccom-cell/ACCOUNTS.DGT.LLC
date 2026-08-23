import postgres from "postgres";
import fs from "fs";

let envContent = "";
if (fs.existsSync("/var/www/dgt-nextjs/.env.local")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env.local", "utf8");
}
if (fs.existsSync("/var/www/dgt-nextjs/.env")) {
  envContent += "\n" + fs.readFileSync("/var/www/dgt-nextjs/.env", "utf8");
}

let dbUrl = "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^["']/, "").replace(/["']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 30 });

async function inspect() {
  const uqs = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'record_translations';
  `;
  console.log("Indexes on record_translations:");
  console.table(uqs);

  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'record_translations'
    ORDER BY ordinal_position;
  `;
  console.log("Columns on record_translations:");
  console.table(cols);

  await sql.end();
}

inspect().catch(console.error);
