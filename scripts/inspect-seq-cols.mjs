import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'transaction_serial_sequences'
    ORDER BY ordinal_position;
  `;
  console.log("transaction_serial_sequences cols:", cols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  await sql.end();
}

main().catch(console.error);
