import fs from 'fs';

const filePath = 'features/journal/components/purchase-order-payment-journal.tsx';
const raw = fs.readFileSync(filePath, 'utf8');
const isCRLF = raw.includes('\r\n');
const lines = raw.split(/\r?\n/);

// 1. Find start of modal header definitions around line 4720
const startIdx = lines.findIndex((l, idx) => idx > 4700 && l.includes('const poCurrencyHeader = String(form.currencyType ||'));
console.log('Found startIdx at:', startIdx);
if (startIdx === -1) {
  console.error('startIdx not found!');
  process.exit(1);
}

// Find end of the statementPurchase calculations: line with countryName
let endIdx = -1;
for (let i = startIdx; i < startIdx + 30; i++) {
  if (lines[i].includes('const countryName = rowCountryName(selected)')) {
    endIdx = i;
    break;
  }
}
console.log('Found endIdx at:', endIdx);
if (endIdx === -1) {
  console.error('endIdx not found!');
  process.exit(1);
}

const replacementLines = [
  '            const poCurrencyHeader = String(form.currencyType || form.currency || selected.currency_code || "USD").toUpperCase();',
  '            const exRate = Number(selected.exchange_rate || form.exchangeRate || 1);',
  '            const exRateHeader = exRate;',
  '',
  '            // Correctly resolve foreign (purchase) amount and local (converted) amount',
  '            const goodsSumFC = Array.isArray(goods) && goods.length > 0',
  '              ? goods.reduce((sum: number, g: any) => sum + Number(g.totalAmount || g.amount || 0), 0)',
  '              : 0;',
  '            const goodsSumLC = Array.isArray(goods) && goods.length > 0',
  '              ? goods.reduce((sum: number, g: any) => sum + Number(g.finalAmount || g.localAmount || 0), 0)',
  '              : 0;',
  '',
  '            const formFC = Number(form.totalAmount || form.subTotal || (selected as any)?.form_data?.totals?.grandPrimaryFinal || 0);',
  '            const rawOrderTotal = Number(selected.order_total || 0);',
  '',
  '            let statementPurchaseForeign = 0;',
  '            let statementPurchaseLocal = 0;',
  '',
  '            if (goodsSumFC > 0) {',
  '              statementPurchaseForeign = goodsSumFC;',
  '              statementPurchaseLocal = goodsSumLC > 0 ? goodsSumLC : goodsSumFC * exRate;',
  '            } else if (formFC > 0) {',
  '              statementPurchaseForeign = formFC;',
  '              statementPurchaseLocal = formFC * exRate;',
  '            } else if (rawOrderTotal > 0) {',
  '              if (exRate > 1) {',
  '                statementPurchaseForeign = rawOrderTotal / exRate;',
  '                statementPurchaseLocal = rawOrderTotal;',
  '              } else {',
  '                statementPurchaseForeign = rawOrderTotal;',
  '                statementPurchaseLocal = rawOrderTotal;',
  '              }',
  '            }',
  '',
  '            const purchaseTotalHeader = statementPurchaseForeign;',
  '            const isCredit = activeMode === "credit" || String(form.paymentType || form.paymentCondition || "").toLowerCase().includes("credit");',
  '            const advancePercent = isCredit ? 0 : Number(form.advancePercent || 0);',
  '            const requiredAdvanceBC = isCredit ? 0 : (purchaseTotalHeader * advancePercent) / 100;',
  '            const paidAdvanceBC = isCredit ? 0 : Number(selected.advance_paid || 0);',
  '            const remainingAdvanceBC = Math.max(0, requiredAdvanceBC - paidAdvanceBC);',
  ''
];

lines.splice(startIdx, endIdx - startIdx, ...replacementLines);

// 2. Fix Post Payment button text and symbols
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Post ${activeMode === "advance" ? "Advance" : "Remaining"} Payment Voucher')) {
    lines[i] = lines[i].replace(
      'Post ${activeMode === "advance" ? "Advance" : "Remaining"} Payment Voucher',
      'Post ${activeMode === "advance" ? "Advance" : isCredit ? "Credit" : "Remaining"} Payment Voucher'
    );
  }
  if (lines[i].includes('âž”')) {
    lines[i] = lines[i].replaceAll('âž”', '→');
  }
  if (lines[i].includes('â Œ')) {
    lines[i] = lines[i].replaceAll('â Œ', '❌');
  }
}

const newContent = lines.join(isCRLF ? '\r\n' : '\n');
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully patched purchase-order-payment-journal.tsx!');
