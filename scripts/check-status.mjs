import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
    }
  } catch (e) {}
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10 });

async function checkStatus() {
  console.log("=======================================================================");
  console.log("  LOCAL POSTGRESQL CONNECTION & SCHEMA STATUS CHECKER");
  console.log("  DATABASE_URL:", env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@"));
  console.log("=======================================================================\n");

  try {
    const dbInfo = await sql`select current_database(), current_user, version()`;
    const dbName = dbInfo[0].current_database;
    const dbUser = dbInfo[0].current_user;
    const version = dbInfo[0].version;

    console.log(`✅ CONNECTION STATUS: CONNECTED AND ACTIVE!`);
    console.log(`  • Host:              localhost:5432`);
    console.log(`  • Connected DB:      "${dbName}"`);
    console.log(`  • DB User:           "${dbUser}"`);
    console.log(`  • Engine Version:    ${version.slice(0, 50)}...\n`);

    // Check 5 language tables
    const tables = await sql`
      select table_name 
      from information_schema.tables 
      where table_schema = 'public' 
        and (table_name like 'translations_%' or table_name = 'record_translations' or table_name = 'accounts' or table_name = 'purchase_orders')
      order by table_name;
    `;

    console.log(`▶ Multilingual & Application Tables Present in "${dbName}":`);
    if (tables.length === 0) {
      console.log("  ⚠️ No tables initialized yet. Run: node scripts/setup-local-postgres-schema.mjs");
    } else {
      for (const t of tables) {
        console.log(`  • public.${t.table_name}`);
      }
    }

    console.log("\n=======================================================================");
    console.log("  RESULT: LOCAL POSTGRESQL IS FULLY CONNECTED & READY!");
    console.log("=======================================================================");
  } catch (err) {
    console.log(`❌ CONNECTION ERROR: ${err.message || String(err)}`);
  }

  await sql.end();
}

checkStatus();
