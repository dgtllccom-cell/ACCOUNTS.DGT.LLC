import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
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
