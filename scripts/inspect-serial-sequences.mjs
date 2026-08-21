import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const sequences = await sql`
    SELECT * FROM transaction_serial_sequences;
  `;
  console.log("=== TRANSACTION SERIAL SEQUENCES ===");
  console.table(sequences);

  const maxSerials = await sql`
    SELECT 
      type,
      max(super_admin_serial_number) as max_super_admin,
      max(country_transaction_serial_number) as max_country,
      max(branch_transaction_serial_number) as max_branch
    FROM roznamcha_entries
    WHERE deleted_at IS NULL
    GROUP BY type;
  `;
  console.log("=== MAX SERIALS IN ROZNAMCHA ===");
  console.table(maxSerials);

  const [proc] = await sql`
    SELECT routine_definition 
    FROM information_schema.routines 
    WHERE routine_name = 'next_transaction_serial';
  `;
  console.log("=== NEXT_TRANSACTION_SERIAL DEFINITION ===");
  console.log(proc?.routine_definition);

  await sql.end();
}

main().catch(console.error);
