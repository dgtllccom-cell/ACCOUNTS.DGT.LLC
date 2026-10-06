import postgres from "postgres";

// Target: Production Supabase Ref: inmayhrxucimxqhgseqi
const PROD_DB_URL = process.env.PROD_DATABASE_URL;
if (!PROD_DB_URL) {
  console.error("FATAL: PROD_DATABASE_URL is not set.");
  process.exit(1);
}

async function checkProdTables() {
  console.log("Checking Production Supabase (inmayhrxucimxqhgseqi) for public_mail tables...");
  const sql = postgres(PROD_DB_URL, { max: 1, connect_timeout: 10 });
  try {
    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'public_mail_%'
      ORDER BY table_name
    `;
    console.log("Existing public_mail tables in Production:", tables.map(t => t.table_name));
    return tables.map(t => t.table_name);
  } finally {
    await sql.end();
  }
}

checkProdTables();
