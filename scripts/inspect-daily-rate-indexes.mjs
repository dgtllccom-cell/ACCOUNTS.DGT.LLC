import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const indexes = await sql`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'daily_usd_rates';
  `;
  console.log("=== DAILY USD RATES INDEXES ===");
  console.table(indexes);

  await sql.end();
}

main().catch(console.error);
