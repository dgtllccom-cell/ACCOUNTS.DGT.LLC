import postgres from 'postgres';

async function main() {
  const connStr = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || "";
  const sql = postgres(connStr, { ssl: 'require' });
  const [po] = await sql`select * from purchase_orders where purchase_order_no = 'AE-001-0003'`;
  console.log('PO AE-001-0003:');
  console.log('ID:', po.id);
  console.log('Status:', po.status);
  console.log('Payment Status:', po.payment_status);
  console.log('Country ID:', po.country_id);
  console.log('Country Branch ID:', po.country_branch_id);
  console.log('City Branch ID:', po.city_branch_id);
  console.log('Dest Country ID:', po.dest_country_id);
  console.log('Dest Country Branch ID:', po.dest_country_branch_id);
  console.log('Dest City Branch ID:', po.dest_city_branch_id);
  console.log('Order Total:', po.order_total);
  console.log('Advance Paid:', po.advance_paid);
  console.log('Remaining Due:', po.remaining_due);
  console.log('Workflow:', JSON.stringify(po.form_data?.workflow, null, 2));
  console.log('Totals:', JSON.stringify(po.form_data?.totals, null, 2));
  console.log('Goods Entries:', JSON.stringify(po.form_data?.goodsEntries, null, 2));
  console.log('Payment Type in form:', po.form_data?.form?.paymentType);
  console.log('Payment Condition in form:', po.form_data?.form?.paymentCondition);

  // Check if any loading records exist for this PO
  const lrs = await sql`select * from purchase_loading_records where purchase_order_id = ${po.id}`;
  console.log('\nLoading Records for AE-001-0003:', lrs.length);
  if (lrs.length > 0) {
    console.table(lrs);
  }

  // No separate transfers table

  await sql.end();
}

main().catch(console.error);
