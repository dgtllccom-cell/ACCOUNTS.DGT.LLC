import fs from 'fs';

const filePath = 'features/journal/components/sales-order-payment-journal.tsx';
const raw = fs.readFileSync(filePath, 'utf8');
const isCRLF = raw.includes('\r\n');
const lines = raw.split(/\r?\n/);

const startIdx = lines.findIndex((l, idx) => idx > 3000 && l.includes('const finalAmount = orderTotal(row);'));
console.log('Found startIdx at:', startIdx);
if (startIdx === -1) {
  console.error('startIdx not found!');
  process.exit(1);
}

// Find the end index: where activeMode === "history" ends
let endIdx = -1;
for (let i = startIdx; i < startIdx + 60; i++) {
  if (lines[i].includes('if (!needle) return true;')) {
    endIdx = i;
    break;
  }
}
console.log('Found endIdx (if (!needle)) at:', endIdx);
if (endIdx === -1) {
  console.error('endIdx not found!');
  process.exit(1);
}

const replacementLines = [
  '      const finalAmount = orderTotal(row);',
  '      const paymentType = String(form.paymentType || form.paymentCondition || "").trim().toLowerCase();',
  '      const isCreditBill = paymentType.includes("credit");',
  '      const isCashBill = paymentType.includes("cash");',
  '      const advancePercent = isCreditBill ? 0 : Number(form.advancePercent || 0);',
  '      const isAdvanceBill = paymentType.includes("advance") || paymentType.includes("endorsement") || (!isCreditBill && !isCashBill && advancePercent > 0);',
  '      const requiredAdvance = (finalAmount * advancePercent) / 100;',
  '      const totalPaid = Number((row as any).paid_amount || 0);',
  '      const paidAdvance = Math.min(requiredAdvance, totalPaid);',
  '      const remainingAdvance = requiredAdvance - paidAdvance;',
  '      const remainingDue = Number((row as any).remaining_amount ?? (finalAmount - totalPaid));',
  '',
  '      const isCreditPaid = (row.payment_status || "").toLowerCase().includes("posted") || ',
  '                           (row.payment_status || "").toLowerCase().includes("paid");',
  '',
  '      const isAdvanceCleared = advancePercent > 0 ? remainingAdvance <= 0.01 : paidAdvance > 0;',
  '      const isRemainingCleared = remainingDue <= 0.01;',
  '',
  '      if (activeMode === "advance") {',
  '        // Strict Business Rule: ONLY show Advance payment bills in Advance Journal',
  '        if (isCreditBill || isCashBill) return false;',
  '        if (!isAdvanceBill && advancePercent <= 0) return false;',
  '',
  '        const isFullyPaid = (row.payment_status || "").toLowerCase() === "paid" || (row.payment_status || "").toLowerCase() === "completed";',
  '        if (isFullyPaid) return false;',
  '        ',
  '        if (advancePercent > 0 && remainingAdvance <= 0.01) return false; // Already cleared required advance',
  '',
  '      } else if (activeMode === "advance_completed") {',
  '        if (isCreditBill || isCashBill) return false;',
  '        if (advancePercent === 0) return false;',
  '        if (remainingAdvance > 0.01) return false; // Not yet cleared',
  '        if (paidAdvance <= 0) return false; // Not paid anything',
  '      } else if (activeMode === "remaining") {',
  '        // Strict Business Rule: Credit and Cash bills do NOT belong in Remaining Journal',
  '        if (isCreditBill || isCashBill) return false;',
  '        if (advancePercent > 0 && remainingAdvance > 0.01) return false;',
  '        if (remainingDue <= 0.01) return false; // Already cleared',
  '',
  '        // NOTE: sales orders have no loading/container-transfer stage (that\'s a Country',
  '        // Purchase concept — sales_loading_records doesn\'t exist in this schema), so unlike',
  '        // the purchase side there is no "must be transferred to loading first" gate here. The',
  '        // advance-cleared + remaining-due checks above are the correct, sufficient eligibility',
  '        // rule for a domestic sales order\'s remaining payment.',
  '      } else if (activeMode === "credit") {',
  '        // Strict Business Rule: ONLY show Credit bills in Credit Payment Journal',
  '        if (!isCreditBill) return false;',
  '        if (isCreditPaid) return false; // Already cleared',
  '      } else if (activeMode === "history") {',
  '        // Show in history if fully cleared',
  '        const isFullyCleared = isCreditBill ? isCreditPaid : ((advancePercent > 0 ? isAdvanceCleared : true) && isRemainingCleared);',
  '        if (!isFullyCleared && !isCreditPaid) return false;',
  '      }',
  ''
];

lines.splice(startIdx, endIdx - startIdx, ...replacementLines);

const newContent = lines.join(isCRLF ? '\r\n' : '\n');
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully replaced lines in sales-order-payment-journal.tsx!');
