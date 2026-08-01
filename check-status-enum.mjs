import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(dbUrl);

async function checkEnum() {
  const enumValues = await sql`
    SELECT unnest(enum_range(NULL::purchase_order_status)) AS value
  `;
  console.log("purchase_order_status enum values:");
  for (const v of enumValues) {
    console.log(`- ${v.value}`);
  }
  process.exit(0);
}

checkEnum().catch(console.error);
