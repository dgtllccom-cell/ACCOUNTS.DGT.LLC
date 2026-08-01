import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(dbUrl);

async function checkEnum() {
  const types = await sql`SELECT typname FROM pg_type WHERE typname IN ('line_payment_type', 'payment_entry_type')`;
  console.log("Types found:", types);
  process.exit(0);
}

checkEnum().catch(console.error);
