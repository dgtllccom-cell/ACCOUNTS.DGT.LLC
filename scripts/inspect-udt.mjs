import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const udt = await sql`
    SELECT specific_name, parameter_name, udt_name, data_type
    FROM information_schema.parameters
    WHERE specific_schema = 'public'
      AND specific_name LIKE '%post_purchase_booking_transfer%';
  `;
  console.table(udt);

  await sql.end();
}

main().catch(console.error);
