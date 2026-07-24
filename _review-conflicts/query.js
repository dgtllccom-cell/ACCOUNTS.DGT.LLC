const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://csesvyxxjivnkkozgopt.supabase.co', process.env.SUPABASE_SECRET_KEY);

async function main() {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, purchase_order_no, ledger_posting_status, payment_status, advance_paid, remaining_due, super_admin_serial_number, country_transaction_serial_number')
    .in('super_admin_serial_number', ['00000010', '00000011', '00000012'])
    .order('super_admin_serial_number');
  
  if (error) console.error("Error PO:", error);
  else console.log("PO:", data);

  const { data: roz, error: rozErr } = await supabase
    .from('roznamcha_entries')
    .select('id, journal_no, voucher_no, entry_date, super_admin_serial_number, amount')
    .in('super_admin_serial_number', ['00000010', '00000011', '00000012'])
    .order('super_admin_serial_number');

  if (rozErr) console.error("Error Roznamcha (by super_admin_serial_number):", rozErr);
  else console.log("Roznamcha (by super admin):", roz);

  // also try to find roznamcha by journal_no mapping to purchase_order_no
  if (data && data.length > 0) {
    const poNos = data.map(d => d.purchase_order_no);
    const { data: roz2, error: rozErr2 } = await supabase
      .from('roznamcha_entries')
      .select('id, journal_no, voucher_no, entry_date, super_admin_serial_number')
      .in('journal_no', poNos);
    if (rozErr2) console.error("Error Roznamcha (by journal_no):", rozErr2);
    else console.log("Roznamcha (by journal_no):", roz2);
  }
}
main();
