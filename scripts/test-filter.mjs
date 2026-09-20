import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let env = {};
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  });
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testCurrentFilter() {
  const { data: rows } = await supabase.from('purchase_orders').select('*').ilike('purchase_order_no', '%AE-001-0001%');
  if (!rows || !rows[0]) { console.log('not found'); return; }
  const row = rows[0];
  const form = row.form_data?.form || {};

  function checkFilter(activeMode) {
    const paymentType = String(form.paymentType || form.paymentCondition || '').trim().toLowerCase();
    const isCreditBill = paymentType.includes('credit');
    const isCashBill = paymentType.includes('cash');
    const advancePercent = isCreditBill ? 0 : Number(form.advancePercent || 0);
    const isAdvanceBill = paymentType.includes('advance') || paymentType.includes('endorsement') || (!isCreditBill && !isCashBill && advancePercent > 0);

    if (activeMode === 'advance') {
      if (isCreditBill || isCashBill) return false;
      if (!isAdvanceBill && advancePercent <= 0) return false;
      return true;
    }
    if (activeMode === 'credit') {
      if (!isCreditBill) return false;
      return true;
    }
    return false;
  }

  console.log('paymentType:', form.paymentType);
  console.log('form.advancePercent:', form.advancePercent);
  console.log('Is in advance tab now?', checkFilter('advance'));
  console.log('Is in credit tab now?', checkFilter('credit'));
}
testCurrentFilter();
