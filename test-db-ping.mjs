import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";

console.log("Testing connection to Supabase Postgres pooler...");
try {
  const sql = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 10 });
  const res = await sql`SELECT NOW(), current_database(), current_user;`;
  console.log("SUCCESS! Database returned:", res);
  await sql.end();
} catch (e) {
  console.error("DATABASE CONNECTION FAILED:", e);
}
