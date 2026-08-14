import postgres from "postgres";

const vpsUrl = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

async function test() {
  console.log("Connecting to VPS database...");
  const sql = postgres(vpsUrl, { max: 1, prepare: false, connect_timeout: 10, ssl: { rejectUnauthorized: false } });
  try {
    const res = await sql`SELECT version();`;
    console.log("VPS DB connected successfully!", res[0]);
  } catch (err) {
    console.error("VPS DB connection error:", err);
  } finally {
    await sql.end();
  }
  process.exit(0);
}

test();
