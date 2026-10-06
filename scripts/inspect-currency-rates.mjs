import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  console.log("=== CURRENCY RATES TABLE SCHEMA & DATA ===");
  const crCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'currency_rates'
    ORDER BY ordinal_position;
  `;
  console.log("currency_rates cols:", crCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  const rates = await sql`
    SELECT * FROM currency_rates LIMIT 10;
  `;
  console.table(rates);

  console.log("\n=== DAILY USD RATES ===");
  const durCols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'daily_usd_rates'
    ORDER BY ordinal_position;
  `;
  console.log("daily_usd_rates cols:", durCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  const durRates = await sql`
    SELECT * FROM daily_usd_rates LIMIT 10;
  `;
  console.table(durRates);

  await sql.end();
}

main().catch(console.error);
