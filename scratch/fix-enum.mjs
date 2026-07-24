import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl, { ssl: 'require' });

async function main() {
  console.log("Adding 'transferred' to document_status enum...");
  try {
    await sql.unsafe(`ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'transferred'`);
    console.log("Enum updated successfully!");
  } catch (e) {
    console.log("Enum update note:", e.message);
  }

  try {
    await sql.unsafe(`ALTER TABLE purchase_orders ALTER COLUMN ledger_posting_status TYPE text`);
    console.log("purchase_orders.ledger_posting_status converted to text!");
  } catch (e) {
    console.log("Column alter note:", e.message);
  }

  try {
    await sql.unsafe(`ALTER TABLE purchase_orders ALTER COLUMN payment_status TYPE text`);
    console.log("purchase_orders.payment_status converted to text!");
  } catch (e) {
    console.log("Payment status alter note:", e.message);
  }

  try {
    await sql.unsafe(`NOTIFY pgrst, 'reload schema'`);
    console.log("PostgREST schema cache reloaded!");
  } catch (e) {
    console.log("Notify note:", e.message);
  }

  await sql.end();
}

main().catch(console.error);
