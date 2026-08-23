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
  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'areas_locations'
    ORDER BY ordinal_position;
  `;
  console.log("Columns in areas_locations:");
  console.table(cols);

  const fks = await sql`
    SELECT
      tc.constraint_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='areas_locations';
  `;
  console.log("Foreign Keys in areas_locations:");
  console.table(fks);

  await sql.end();
}

inspect().catch(console.error);
