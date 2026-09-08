import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

async function run() {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
  const [res] = await sql`SELECT crypt('Gulistan@123', gen_salt('bf', 10)) as hash;`;
  console.log('Crypt test hash:', res.hash);
  await sql.end();
}
run();
