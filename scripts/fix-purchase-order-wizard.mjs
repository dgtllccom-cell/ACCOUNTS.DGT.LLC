import fs from 'fs';

const filePath = 'features/purchases/components/purchase-order-wizard.jsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Fix row.coursePrice.toFixed(2) in Goods list
code = code.replace(
  '{row.coursePrice.toFixed(2)}',
  '{Number(row.coursePrice || row.price || 0).toFixed(2)}'
);

// 2. Fix row.qtyNo.toLocaleString() in Goods list
code = code.replace(
  '<td className="px-3 py-2 text-right font-mono font-bold">{row.qtyNo.toLocaleString()}</td>',
  '<td className="px-3 py-2 text-right font-mono font-bold">{Number(row.qtyNo || 0).toLocaleString()}</td>'
);

// 3. Fix row.totalAmount.toLocaleString() in Goods list
code = code.replace(
  '<td className="px-3 py-2 text-right font-mono font-black text-yellow-600 dark:text-yellow-450">{row.totalAmount.toLocaleString()}</td>',
  '<td className="px-3 py-2 text-right font-mono font-black text-yellow-600 dark:text-yellow-450">{Number(row.totalAmount || row.amount || 0).toLocaleString()}</td>'
);

// 4. Fix row.finalAmount.toLocaleString in Goods list
code = code.replace(
  '{row.finalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}',
  '{Number(row.finalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}'
);

// 5. Fix currentItemTotals placeholders
code = code.replace(
  'placeholder={currentItemTotals.totalAmount.toFixed(2)}',
  'placeholder={(Number(currentItemTotals?.totalAmount) || 0).toFixed(2)}'
);
code = code.replace(
  'placeholder={currentItemTotals.finalAmount.toFixed(2)}',
  'placeholder={(Number(currentItemTotals?.finalAmount) || 0).toFixed(2)}'
);

// 6. Fix Report table goodsEntries rows
code = code.replace(
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-bold text-slate-900">{row.qtyNo.toLocaleString()} {row.qtyName}</td>',
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-bold text-slate-900">{Number(row.qtyNo || 0).toLocaleString()} {row.qtyName || ""}</td>'
);
code = code.replace(
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono text-slate-700">{row.grossWeight.toFixed(2)}</td>',
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono text-slate-700">{Number(row.grossWeight || (Number(row.qtyNo || 0) * Number(row.qtyKgs || 0)) || 0).toFixed(2)}</td>'
);
code = code.replace(
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-bold text-slate-800">{row.netWeight.toFixed(2)}</td>',
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-bold text-slate-800">{Number(row.netWeight || (Number(row.qtyNo || 0) * (Number(row.qtyKgs || 0) - Number(row.emptyKgs || 0))) || 0).toFixed(2)}</td>'
);
code = code.replace(
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono text-slate-700">{row.coursePrice.toFixed(2)}</td>',
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono text-slate-700">{Number(row.coursePrice || row.price || 0).toFixed(2)}</td>'
);
code = code.replace(
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-bold text-slate-800">{row.totalAmount.toLocaleString()}</td>',
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-bold text-slate-800">{Number(row.totalAmount || row.amount || 0).toLocaleString()}</td>'
);
code = code.replace(
  '{row.finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}',
  '{Number(row.finalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}'
);

// 7. Fix reportTotals in Report table
code = code.replace(
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-black">{reportTotals.totalQty.toLocaleString()} {goodsEntries[0]?.qtyName || ""}</td>',
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-black">{Number(reportTotals.totalQty || 0).toLocaleString()} {goodsEntries[0]?.qtyName || ""}</td>'
);
code = code.replace(
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono">{reportTotals.totalGross.toFixed(2)}</td>',
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono">{Number(reportTotals.totalGross || 0).toFixed(2)}</td>'
);
code = code.replace(
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-black">{reportTotals.totalNet.toFixed(2)}</td>',
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-black">{Number(reportTotals.totalNet || 0).toFixed(2)}</td>'
);
code = code.replace(
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-black text-slate-900">{reportTotals.grandPrimaryFinal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>',
  '<td className="p-2.5 text-right border-r border-slate-200 font-mono font-black text-slate-900">{Number(reportTotals.grandPrimaryFinal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>'
);
code = code.replace(
  '<td className="p-2.5 text-right font-mono font-black text-emerald-800 bg-emerald-100/70">{reportTotals.grandFinal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>',
  '<td className="p-2.5 text-right font-mono font-black text-emerald-800 bg-emerald-100/70">{Number(reportTotals.grandFinal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>'
);

// 8. Fix handleViewGoodsEntry
code = code.replace(
  'Amount: ${row.totalAmount.toLocaleString()} ${row.currencyType}',
  'Amount: ${Number(row.totalAmount || 0).toLocaleString()} ${row.currencyType || ""}'
);

// 9. Fix contract preview
code = code.replace(
  '<td className="border-r border-slate-200 p-1.5 text-right font-bold">{g.qtyNo.toLocaleString()}</td>',
  '<td className="border-r border-slate-200 p-1.5 text-right font-bold">{Number(g.qtyNo || 0).toLocaleString()}</td>'
);
code = code.replace(
  '<td className="p-1.5 text-right font-bold">{g.finalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>',
  '<td className="p-1.5 text-right font-bold">{Number(g.finalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>'
);
code = code.replace(
  '<td className="border-r border-slate-200 p-1.5 text-right">{reportTotals.totalQty.toLocaleString()}</td>',
  '<td className="border-r border-slate-200 p-1.5 text-right">{Number(reportTotals.totalQty || 0).toLocaleString()}</td>'
);
code = code.replace(
  '<td className="p-1.5 text-right">{form.secondaryCurrency || "PKR"} {reportTotals.grandFinal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>',
  '<td className="p-1.5 text-right">{form.secondaryCurrency || "PKR"} {Number(reportTotals.grandFinal || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>'
);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated purchase-order-wizard.jsx with safe numeric guards!');
