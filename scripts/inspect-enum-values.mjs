import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const enums = await sql`
    SELECT pg_enum.enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'purchase_order_payment_kind';
  `;
  console.log("purchase_order_payment_kind values:", enums.map(e => e.enumlabel));

  await sql.end();
}

main().catch(console.error);
