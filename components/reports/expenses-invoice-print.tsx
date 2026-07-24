import React from "react";

export function ExpensesInvoicePrint({ bill }: { bill: any }) {
  if (!bill) return null;

  const totalQty = bill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.qty), 0) || 0;
  const taxableValue = bill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.amount), 0) || 0;
  const taxAmount = bill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.tax_amt), 0) || 0;
  const grandTotal = bill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.grand_amount), 0) || 0;
  const currency = bill.city_branches?.countries?.currency_code || "";

  // Convert number to words (simple implementation for now)
  const numberToWords = (num: number) => {
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const teens = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    
    if (num === 0) return 'ZERO';
    let words = '';
    if (num >= 1000) {
      words += ones[Math.floor(num / 1000)] + ' THOUSAND ';
      num %= 1000;
    }
    if (num >= 100) {
      words += ones[Math.floor(num / 100)] + ' HUNDRED ';
      num %= 100;
    }
    if (num >= 20) {
      words += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    } else if (num >= 10) {
      words += teens[num - 10] + ' ';
      num = 0;
    }
    if (num > 0) {
      words += ones[Math.floor(num)] + ' ';
    }
    return words.trim() + ` ${currency} ONLY`;
  };

  return (
    <div className="w-full bg-white text-black p-4 font-sans print:p-0 print:m-0" style={{ fontSize: "11px" }}>
      {/* Header */}
      <div className="border border-slate-800 p-4 pb-2 text-center relative flex justify-between items-center">
        <div className="text-left">
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter" style={{ fontFamily: "Impact, sans-serif" }}>DAMAAN GROUP ERP</h1>
          <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wide">Enterprise Resource Planning & General Ledger</p>
        </div>
        <div className="text-right flex flex-col items-end">
          {/* Mock Logo or Text Logo */}
          <div className="w-16 h-16 bg-slate-800 text-white flex items-center justify-center font-bold text-xl rounded-sm">
            DG
          </div>
          <span className="font-bold text-xs mt-1">DAMAAN GROUP</span>
        </div>
      </div>
      
      <div className="bg-slate-700 text-white font-bold px-4 py-1 text-xs uppercase text-center border-x border-slate-800">
        Internal Management System & Operations
      </div>

      <div className="border border-slate-800 flex text-xs">
        <div className="w-1/2 p-2 border-r border-slate-800">
          <p><strong>System ID :</strong> {bill.profiles?.id?.substring(0, 8).toUpperCase()}</p>
          <p><strong>Country :</strong> {bill.city_branches?.countries?.name}</p>
        </div>
        <div className="w-1/2 p-2 flex items-center justify-center bg-slate-100">
          <h2 className="text-xl font-bold uppercase tracking-widest text-slate-800">EXPENSES BILL</h2>
        </div>
      </div>

      {/* Info Block */}
      <div className="flex border-t border-b border-slate-800 text-[10px]">
        {/* Left Side: Invoice Info */}
        <div className="w-1/2 border-r border-slate-800 p-3">
          <div className="text-left font-bold border-b border-slate-300 pb-1 mb-2 uppercase text-[10px] text-slate-700">Document Information</div>
          <table className="w-full">
            <tbody>
              <tr>
                <td className="font-bold py-1 w-24 text-slate-700">Serial No.</td>
                <td className="font-black text-slate-900">: {bill.serial_no}</td>
              </tr>
              <tr>
                <td className="font-bold py-1 text-slate-700">Bill Date</td>
                <td className="font-medium">: {bill.bill_date ? new Date(bill.bill_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : ""}</td>
              </tr>
              <tr>
                <td className="font-bold py-1 text-slate-700">Branch Name</td>
                <td className="font-medium">: {bill.city_branches?.name}</td>
              </tr>
              <tr>
                <td className="font-bold py-1 text-slate-700">Reference No.</td>
                <td className="font-medium">: {bill.reference_no || '-'}</td>
              </tr>
              <tr>
                <td className="font-bold py-1 text-slate-700">Status</td>
                <td className="font-medium">: {bill.transferred_to_roznamcha ? "POSTED" : "UNPOSTED"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Right Side: Billed To */}
        <div className="w-1/2 p-3 bg-slate-50">
          <div className="text-left font-bold border-b border-slate-300 pb-1 mb-2 uppercase text-[10px] text-slate-700">Billed To (DR Account)</div>
          <div className="mt-2">
             <p className="font-mono text-sm uppercase font-black text-slate-900 leading-tight">
               {bill.debit_ledger_name || (bill.debit_ledger_id ? "Linked Ledger (ID: " + bill.debit_ledger_id.substring(0,8) + ")" : "NOT SELECTED")}
             </p>
             <p className="text-[10px] text-slate-600 mt-2 font-medium">System ID: {bill.debit_ledger_id ? bill.debit_ledger_id.substring(0,8).toUpperCase() : "-"}</p>
             <p className="text-[10px] text-slate-600 font-medium">Created By: {bill.profiles?.full_name || 'System Admin'}</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full border-x border-b border-slate-800 text-[9px] mt-4">
        <thead>
          <tr className="border-b border-slate-800 text-center font-bold bg-slate-100">
            <td className="border-r border-slate-800 p-1 w-6">No.</td>
            <td className="border-r border-slate-800 p-1 text-left">Description of Expense</td>
            <td className="border-r border-slate-800 p-1 w-8">Qty</td>
            <td className="border-r border-slate-800 p-1 w-12">U. Price</td>
            <td className="border-r border-slate-800 p-1 w-14">Amount</td>
            <td className="border-r border-slate-800 p-1 w-8">Cur</td>
            <td className="border-r border-slate-800 p-1 w-6">Op</td>
            <td className="border-r border-slate-800 p-1 w-12">Rate</td>
            <td className="border-r border-slate-800 p-1 w-14">Final</td>
            <td className="border-r border-slate-800 p-1 w-10">Tax %</td>
            <td className="border-r border-slate-800 p-1 w-12">Tax Amt</td>
            <td className="p-1 w-16 text-right">Total</td>
          </tr>
        </thead>
        <tbody>
          {bill.expenses_bill_lines?.map((line: any, idx: number) => (
            <tr key={idx} className="text-center border-b border-slate-200 last:border-b-0">
              <td className="border-r border-slate-800 p-1 align-top">{idx + 1}</td>
              <td className="border-r border-slate-800 p-1 text-left align-top font-medium">{line.details}</td>
              <td className="border-r border-slate-800 p-1 align-top">{line.qty}</td>
              <td className="border-r border-slate-800 p-1 align-top text-right">{Number(line.unit_price).toFixed(2)}</td>
              <td className="border-r border-slate-800 p-1 align-top text-right">{Number(line.amount).toFixed(2)}</td>
              <td className="border-r border-slate-800 p-1 uppercase align-top">{line.currency || "-"}</td>
              <td className="border-r border-slate-800 p-1 font-mono align-top">{line.operation || "-"}</td>
              <td className="border-r border-slate-800 p-1 align-top text-right">{line.exchange_rate ? Number(line.exchange_rate).toFixed(4) : "-"}</td>
              <td className="border-r border-slate-800 p-1 align-top text-right">{line.final_amount ? Number(line.final_amount).toFixed(2) : "-"}</td>
              <td className="border-r border-slate-800 p-1 align-top">{line.tax_pct ? `${line.tax_pct}%` : "-"}</td>
              <td className="border-r border-slate-800 p-1 align-top text-right">{line.tax_amt ? Number(line.tax_amt).toFixed(2) : "-"}</td>
              <td className="p-1 align-top text-right font-bold">{Number(line.grand_amount).toFixed(2)}</td>
            </tr>
          ))}
          {/* Blank row to fill space if needed */}
          <tr className="border-t-2 border-slate-800 font-bold bg-slate-50">
            <td colSpan={2} className="border-r border-slate-800 p-1 text-right uppercase">Grand Total (Incl. Tax)</td>
            <td className="border-r border-slate-800 p-1 text-center">{totalQty}</td>
            <td className="border-r border-slate-800 p-1"></td>
            <td className="border-r border-slate-800 p-1 text-right">{taxableValue.toFixed(2)}</td>
            <td className="border-r border-slate-800 p-1 text-right" colSpan={5}></td>
            <td className="border-r border-slate-800 p-1 text-right">{taxAmount.toFixed(2)}</td>
            <td className="p-1 text-right font-black text-[11px] text-slate-900">{grandTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals & Footer Block */}
      <div className="border-x border-b border-slate-800 flex text-xs">
        <div className="w-2/3 border-r border-slate-800 p-2 flex flex-col justify-center">
          <p className="font-bold border-b border-slate-300 pb-1 mb-2">Total Amount in words</p>
          <p className="uppercase font-medium text-sm pl-4 italic">{numberToWords(grandTotal)}</p>
        </div>
        <div className="w-1/3">
          <div className="flex justify-between p-2 border-b border-slate-800">
            <span>Taxable Amount</span>
            <span>{taxableValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between p-2 border-b border-slate-800">
            <span>Add : TAX</span>
            <span>{taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between p-2 font-bold bg-slate-100">
            <span>Total Amount After Tax</span>
            <span className="text-sm">{currency} {grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="border-x border-b border-slate-800 flex text-xs h-32">
        <div className="w-2/3 border-r border-slate-800 p-2 relative">
          <p className="font-bold underline mb-1">Terms and Conditions</p>
          <ul className="list-disc pl-4 text-[9px] text-slate-600 leading-tight">
            <li>Subject to internal branch jurisdiction.</li>
            <li>Our responsibility ceases as soon as the expense is recorded.</li>
            <li>Expenses once recorded and posted cannot be easily reverted without Admin rights.</li>
          </ul>
        </div>
        <div className="w-1/3 relative flex flex-col">
          <div className="p-1 text-center text-[8px] italic text-slate-500 border-b border-slate-300">
            Certified that the particulars given above are true and correct.
          </div>
          <div className="p-2 text-center font-bold">
            For DAMAAN GROUP
          </div>
          <div className="mt-auto p-2 text-center text-[10px] font-bold border-t border-slate-300">
            Authorised Signatory
          </div>
        </div>
      </div>
      
      <div className="text-center mt-2 text-[10px] text-slate-500 italic">
        Thank you for your business! This is a computer generated document.
      </div>
    </div>
  );
}
