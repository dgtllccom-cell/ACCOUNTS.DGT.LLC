
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
    dbUrl = trimmed.replace("DATABASE_URL=", "").replace(/^[\"\']/, "").replace(/[\"\']$/, "");
  }
}

const sql = postgres(dbUrl, { max: 1, connect_timeout: 15 });

async function check() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%locat%' OR table_name LIKE '%countr%' OR table_name LIKE '%state%' OR table_name LIKE '%district%' OR table_name LIKE '%cit%' OR table_name LIKE '%translat%')
    ORDER BY table_name
  `;
  console.log("RELEVANT TABLES:", tables.map(t => t.table_name));

  for (const t of ["countries", "states_provinces", "districts", "cities", "areas_locations", "record_translations", "translations_english", "translations_urdu"]) {
    try {
      const cols = await sql`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${t}`;
      console.log("\nTABLE:", t, "(" + cols.length + " cols)");
      cols.forEach(c => console.log("  - " + c.column_name + ": " + c.data_type + (c.is_nullable === "NO" ? " (NOT NULL)" : "")));
    } catch (e) {
      console.log("Error checking " + t + ":", e.message);
    }
  }

  await sql.end();
}

check().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
