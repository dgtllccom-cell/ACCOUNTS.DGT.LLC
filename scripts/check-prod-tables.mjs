import postgres from "postgres";

// Target: Production Supabase Ref: inmayhrxucimxqhgseqi
const PROD_DB_URL = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

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
