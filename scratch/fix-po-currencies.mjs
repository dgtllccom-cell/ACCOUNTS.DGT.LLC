import postgres from 'postgres';

const dbUrl = "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl, { ssl: 'require' });

async function main() {
  console.log("Checking purchase_orders records for corrupted currency_code...");
  const rows = await sql`
    SELECT id, purchase_order_no, currency_code, purchase_currency, payment_currency, form_data 
    FROM purchase_orders
  `;

  for (const r of rows) {
    const form = r.form_data?.form || {};
    const intendedPurchaseCur = form.currencyType || form.purchaseCurrency || "USD";
    const intendedPaymentCur = form.secondaryCurrency?.split(" ")[0] || "PKR";

    if (r.currency_code !== intendedPurchaseCur || r.purchase_currency !== intendedPurchaseCur || r.payment_currency !== intendedPaymentCur) {
      console.log(`Updating ${r.purchase_order_no}: setting currency_code=${intendedPurchaseCur}, purchase_currency=${intendedPurchaseCur}, payment_currency=${intendedPaymentCur}`);
      await sql`
        UPDATE purchase_orders
        SET currency_code = ${intendedPurchaseCur},
            purchase_currency = ${intendedPurchaseCur},
            payment_currency = ${intendedPaymentCur}
        WHERE id = ${r.id}
      `;
    }
  }

  console.log("Done checking/updating purchase_orders currencies.");
  await sql.end();
}

main().catch(console.error);
