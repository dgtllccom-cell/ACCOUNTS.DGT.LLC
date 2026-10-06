import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const idx = await sql`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'roznamcha_entries';
  `;
  console.log("=== ROZNAMCHA ENTRIES INDEXES ===");
  console.table(idx);

  await sql.end();
}

main().catch(console.error);
