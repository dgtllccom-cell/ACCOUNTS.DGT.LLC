import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const args = await sql`
    SELECT parameter_name, data_type, parameter_mode, ordinal_position
    FROM information_schema.parameters
    WHERE specific_schema = 'public'
      AND specific_name LIKE '%post_purchase_booking_transfer%'
    ORDER BY ordinal_position;
  `;
  console.log("post_purchase_booking_transfer parameters:");
  console.table(args);

  const sArgs = await sql`
    SELECT parameter_name, data_type, parameter_mode, ordinal_position
    FROM information_schema.parameters
    WHERE specific_schema = 'public'
      AND specific_name LIKE '%post_sales_booking_transfer%'
    ORDER BY ordinal_position;
  `;
  console.log("post_sales_booking_transfer parameters:");
  console.table(sArgs);

  await sql.end();
}

main().catch(console.error);
