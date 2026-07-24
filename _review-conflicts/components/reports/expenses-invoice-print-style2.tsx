import React from "react";

export function ExpensesInvoicePrintStyle2({ bill }: { bill: any }) {
  if (!bill) return null;

  const totalQty = bill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.qty), 0) || 0;
  const grandTotal = bill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.grand_amount), 0) || 0;
  const currency = bill.city_branches?.countries?.currency_code || "";

  // Convert number to words (simple implementation)
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

  const formattedDate = bill.bill_date ? new Date(bill.bill_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
  const formattedTime = new Date(bill.created_at || Date.now()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="w-full bg-white text-black p-4 font-sans print:p-0 print:m-0" style={{ fontSize: "11px" }}>
      <div className="border border-slate-800">
        
        {/* Top Header */}
        <div className="flex justify-between p-1 border-b border-slate-800 text-[10px]">
          <span>Page No. 1 of 1</span>
          <span className="font-bold tracking-widest uppercase">EXPENSES BILL</span>
          <span>Original Copy</span>
        </div>

        {/* Company Info */}
        <div className="flex border-b border-slate-800">
          <div className="w-1/6 border-r border-slate-800 flex items-center justify-center p-4">
            <div className="text-center font-bold text-slate-400 text-lg border-2 border-slate-300 rounded p-4">
              Add<br />Logo
            </div>
          </div>
          <div className="w-5/6 text-center py-2 flex flex-col justify-center">
            <h1 className="font-black text-xl tracking-wide uppercase">DAMAAN GROUP ERP</h1>
            <p className="text-xs mt-1">Head Office / Corporate Management</p>
            <p className="text-[10px] mt-1">Mobile: +971-50-0000000 | Email: info@damaan.com</p>
            <p className="text-[10px]">Country: {bill.city_branches?.countries?.name} | Currency: {currency}</p>
          </div>
        </div>

        {/* Details & Billed To Row */}
        <div className="flex border-b border-slate-800 text-xs">
          {/* Left Side: Invoice Information */}
          <div className="w-1/2 border-r border-slate-800 p-3">
            <p className="font-bold mb-2 uppercase text-[10px] border-b border-slate-300 pb-1 text-slate-700">Document Information</p>
            <table className="w-full text-[10px]">
              <tbody>
                <tr><td className="w-32 font-bold py-0.5">Invoice Number</td><td className="font-black text-slate-900">: {bill.serial_no}</td></tr>
                <tr><td className="font-bold py-0.5">Invoice Date</td><td>: {formattedDate}</td></tr>
                <tr><td className="font-bold py-0.5">Branch Name</td><td>: {bill.city_branches?.name}</td></tr>
                <tr><td className="font-bold py-0.5">Reference No.</td><td>: {bill.reference_no || '-'}</td></tr>
                <tr><td className="font-bold py-0.5">Status</td><td>: {bill.transferred_to_roznamcha ? "POSTED TO LEDGER" : "UNPOSTED"}</td></tr>
              </tbody>
            </table>
          </div>
          
          {/* Right Side: Billed To (Debit Account) */}
          <div className="w-1/2 p-3 bg-slate-50">
            <p className="font-bold mb-2 uppercase text-[10px] border-b border-slate-300 pb-1 text-slate-700">Billed To (DR Account)</p>
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
        <table className="w-full text-[9px]">
          <thead>
            <tr className="border-b border-slate-800 text-center font-bold bg-slate-100">
              <td className="border-r border-slate-800 p-1 w-6">No.</td>
              <td className="border-r border-slate-800 p-1 text-left">Item Description</td>
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
                <td className="border-r border-slate-800 p-1">{idx + 1}</td>
                <td className="border-r border-slate-800 p-1 text-left">{line.details}</td>
                <td className="border-r border-slate-800 p-1">{line.qty}</td>
                <td className="border-r border-slate-800 p-1 text-right">{Number(line.unit_price).toFixed(2)}</td>
                <td className="border-r border-slate-800 p-1 text-right">{Number(line.amount).toFixed(2)}</td>
                <td className="border-r border-slate-800 p-1 uppercase">{line.currency || "-"}</td>
                <td className="border-r border-slate-800 p-1 font-mono">{line.operation || "-"}</td>
                <td className="border-r border-slate-800 p-1 text-right">{line.exchange_rate ? Number(line.exchange_rate).toFixed(4) : "-"}</td>
                <td className="border-r border-slate-800 p-1 text-right">{line.final_amount ? Number(line.final_amount).toFixed(2) : "-"}</td>
                <td className="border-r border-slate-800 p-1">{line.tax_pct ? `${line.tax_pct}%` : "-"}</td>
                <td className="border-r border-slate-800 p-1 text-right">{line.tax_amt ? Number(line.tax_amt).toFixed(2) : "-"}</td>
                <td className="p-1 text-right font-bold">{Number(line.grand_amount).toFixed(2)}</td>
              </tr>
            ))}
            
            {/* Blank rows to fill space */}
            <tr className="border-t-2 border-slate-800 bg-slate-50">
              <td className="border-r border-slate-800 p-1 font-bold text-right uppercase" colSpan={2}>Grand Total (Incl. Tax)</td>
              <td className="border-r border-slate-800 p-1 font-bold text-center">{totalQty}</td>
              <td className="border-r border-slate-800 p-1 text-right font-bold" colSpan={8}></td>
              <td className="p-1 font-black text-right text-[11px] text-slate-900">{grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Total In Words Row */}
        <div className="border-t border-slate-800 border-b border-slate-800 p-2 bg-slate-50">
          <p className="text-[10px]"><span className="font-bold">Rs.</span> <span className="uppercase font-medium italic">{numberToWords(grandTotal)}</span></p>
        </div>

        {/* Footer Area */}
        <div className="flex h-32">
          {/* Terms */}
          <div className="w-1/3 border-r border-slate-800 p-2">
            <p className="font-bold text-[10px]">Terms and Conditions</p>
            <p className="text-[9px] mt-1">E. & O.E.</p>
            <ol className="list-decimal pl-3 mt-1 text-[8px] text-slate-600 leading-tight">
              <li>Goods once sold will not be taken back.</li>
              <li>Interest @ 18% p.a. will be charged if payment is not made within the stipulated time.</li>
              <li>Subject to local jurisdiction only.</li>
            </ol>
          </div>
          
          {/* Bank / QR */}
          <div className="w-1/3 border-r border-slate-800 p-2 flex flex-col justify-center items-center">
            <div className="w-12 h-12 bg-slate-200 mb-2 border border-slate-300"></div>
            <div className="text-[9px] w-full pl-2">
              <p><strong>Account Number:</strong> 123456789</p>
              <p><strong>Bank:</strong> Damaan Central Bank</p>
              <p><strong>IFSC:</strong> DAMN000123</p>
              <p><strong>Branch:</strong> Head Office</p>
            </div>
          </div>

          {/* Signature */}
          <div className="w-1/3 p-2 flex flex-col relative">
            <p className="font-bold text-[10px] text-right">For DAMAAN GROUP ERP</p>
            <div className="mt-auto text-[10px] text-right font-bold">
              Signature
            </div>
          </div>
        </div>

      </div>
      <div className="text-center mt-2 text-[9px] text-blue-600">
        Invoice Created by Damaan ERP System
      </div>
    </div>
  );
}
