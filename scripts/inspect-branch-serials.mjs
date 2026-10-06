import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const rows = await sql`
    SELECT id, branch_transaction_serial_number, city_branch_transaction_serial, created_at
    FROM roznamcha_entries
    WHERE city_branch_id = '79b31aba-45f1-4aba-9068-fb3eb2102a81'
    ORDER BY created_at DESC;
  `;
  console.table(rows);

  await sql.end();
}

main().catch(console.error);
