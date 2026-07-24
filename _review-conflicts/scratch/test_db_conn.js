import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl, { ssl: 'require' });

async function check() {
  try {
    const res = await sql`SELECT version()`;
    console.log("Database connection successful:", res[0].version);
  } catch (err) {
    console.error("Database connection failed:", err);
  } finally {
    await sql.end();
  }
}

check();
