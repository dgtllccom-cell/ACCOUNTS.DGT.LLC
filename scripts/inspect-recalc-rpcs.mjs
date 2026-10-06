import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, { max: 1, prepare: false });

async function main() {
  const procs = await sql`
    SELECT routine_name, routine_definition
    FROM information_schema.routines
    WHERE specific_schema = 'public'
      AND routine_name IN ('recalc_purchase_order_payment_totals', 'recalc_sales_order_payment_totals', 'post_roznamcha_entry');
  `;
  for (const p of procs) {
    console.log(`\n=================== FUNCTION: ${p.routine_name} ===================`);
    console.log(p.routine_definition);
  }

  await sql.end();
}

main().catch(console.error);
