import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

console.log("Testing connection to Supabase Postgres pooler...");
try {
  const sql = postgres(dbUrl, { max: 1, prepare: false, connect_timeout: 10 });
  const res = await sql`SELECT NOW(), current_database(), current_user;`;
  console.log("SUCCESS! Database returned:", res);
  await sql.end();
} catch (e) {
  console.error("DATABASE CONNECTION FAILED:", e);
}
