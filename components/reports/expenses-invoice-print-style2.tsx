import React from "react";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";

export function ExpensesInvoicePrintStyle2({ bill }: { bill: any }) {
  const lang = useActiveLanguage();
  if (!bill) return null;

  const totalQty = bill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.qty), 0) || 0;
  const grandTotal = bill.expenses_bill_lines?.reduce((sum: number, l: any) => sum + Number(l.grand_amount), 0) || 0;
  const currency = bill.city_branches?.countries?.currency_code || "";

  // Dynamic branding from the bill's own company / branch — NEVER a hard-coded "Damaan".
  const cb = bill.city_branches || {};
  const brandName: string =
    bill.company_name ||
    bill.companies?.name ||
    cb.company_name ||
    cb.companies?.name ||
    cb.branding_company_name ||
    cb.name ||
    "";
  const brandPhone: string = cb.phone || cb.contact_number || bill.companies?.phone || "";
  const brandEmail: string = cb.email || bill.companies?.email || "";
  const brandCountry: string = cb.countries?.name || "";
  // Bank / beneficiary details — only the branch's own real values; the whole block is
  // omitted when none are configured (was hard-coded "Damaan Central Bank / 123456789").
  const bankName: string = cb.bank_name || bill.companies?.bank_name || "";
  const bankAccountNo: string = cb.bank_account_no || bill.companies?.bank_account_no || "";
  const bankIfsc: string = cb.bank_ifsc || cb.bank_swift || bill.companies?.bank_ifsc || "";
  const bankBranch: string = cb.bank_branch || "";
  const hasBank = Boolean(bankName || bankAccountNo || bankIfsc || bankBranch);

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
          <span>{t(lang, "pdfui.eip2_page_no_1_of_1", "Page No. 1 of 1")}</span>
          <span className="font-bold tracking-widest uppercase">{t(lang, "pdfui.eip_expenses_bill", "EXPENSES BILL")}</span>
          <span>{t(lang, "pdfui.eip2_original_copy", "Original Copy")}</span>
        </div>

        {/* Company Info */}
        <div className="flex border-b border-slate-800">
          <div className="w-1/6 border-r border-slate-800 flex items-center justify-center p-4">
            <div className="text-center font-bold text-slate-400 text-lg border-2 border-slate-300 rounded p-4">
              {t(lang, "company_form.add_button", "Add")}<br />{t(lang, "pdfui.eip2_logo", "Logo")}
            </div>
          </div>
          <div className="w-5/6 text-center py-2 flex flex-col justify-center">
            <h1 className="font-black text-xl tracking-wide uppercase">{brandName || t(lang, "pdfui.eip2_expenses_bill_heading", "Expenses Bill")}</h1>
            <p className="text-xs mt-1">{t(lang, "pdfui.eip2_head_office_corporate_mgmt", "Head Office / Corporate Management")}</p>
            {(brandPhone || brandEmail) && (
              <p className="text-[10px] mt-1">
                {brandPhone && <>{t(lang, "roz.cef_mobile_label", "Mobile")}: {brandPhone}</>}
                {brandPhone && brandEmail && " | "}
                {brandEmail && <>{t(lang, "acct.apv_email", "Email")}: {brandEmail}</>}
              </p>
            )}
            <p className="text-[10px]">{t(lang, "purchase.country", "Country")}: {brandCountry || "—"} | {t(lang, "lpjr.col_cur", "Cur")}: {currency}</p>
          </div>
        </div>

        {/* Details & Billed To Row */}
        <div className="flex border-b border-slate-800 text-xs">
          {/* Left Side: Invoice Information */}
          <div className="w-1/2 border-r border-slate-800 p-3">
            <p className="font-bold mb-2 uppercase text-[10px] border-b border-slate-300 pb-1 text-slate-700">{t(lang, "pdfui.eip_document_information", "Document Information")}</p>
            <table className="w-full text-[10px]">
              <tbody>
                <tr><td className="w-32 font-bold py-0.5">{t(lang, "roz.cef_invoice_number_label", "Invoice Number")}</td><td className="font-black text-slate-900">: {bill.serial_no}</td></tr>
                <tr><td className="font-bold py-0.5">{t(lang, "lpjr.inv_inv_date", "Invoice Date")}</td><td>: {formattedDate}</td></tr>
                <tr><td className="font-bold py-0.5">{t(lang, "cdash.col_branch_name", "Branch Name")}</td><td>: {bill.city_branches?.name}</td></tr>
                <tr><td className="font-bold py-0.5">{t(lang, "acct.reference_no", "Reference No.")}</td><td>: {bill.reference_no || '-'}</td></tr>
                <tr><td className="font-bold py-0.5">{t(lang, "log.tbl_status", "Status")}</td><td>: {bill.transferred_to_roznamcha ? t(lang, "pdfui.eip2_posted_to_ledger", "POSTED TO LEDGER") : t(lang, "pdfui.eip_unposted", "UNPOSTED")}</td></tr>
              </tbody>
            </table>
          </div>
          
          {/* Right Side: Billed To (Debit Account) */}
          <div className="w-1/2 p-3 bg-slate-50">
            <p className="font-bold mb-2 uppercase text-[10px] border-b border-slate-300 pb-1 text-slate-700">{t(lang, "pdfui.eip_billed_to_dr_account", "Billed To (DR Account)")}</p>
            <div className="mt-2">
               <p className="font-mono text-sm uppercase font-black text-slate-900 leading-tight">
                 {bill.debit_ledger_name || (bill.debit_ledger_id ? t(lang, "pdfui.eip_linked_ledger_id_prefix", "Linked Ledger (ID:") + " " + bill.debit_ledger_id.substring(0,8) + ")" : t(lang, "pdfui.eip_not_selected", "NOT SELECTED"))}
               </p>
               <p className="text-[10px] text-slate-600 mt-2 font-medium">{t(lang, "pdfui.eip_system_id_no_space_colon", "System ID:")} {bill.debit_ledger_id ? bill.debit_ledger_id.substring(0,8).toUpperCase() : "-"}</p>
               <p className="text-[10px] text-slate-600 font-medium">{t(lang, "pdfui.eip_created_by_colon", "Created By:")} {bill.profiles?.full_name || t(lang, "pdfui.eip_system_admin", "System Admin")}</p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-[9px]">
          <thead>
            <tr className="border-b border-slate-800 text-center font-bold bg-slate-100">
              <td className="border-r border-slate-800 p-1 w-6">{t(lang, "ledger.col_no", "No.")}</td>
              <td className="border-r border-slate-800 p-1 text-left">{t(lang, "pdfui.eip2_item_description", "Item Description")}</td>
              <td className="border-r border-slate-800 p-1 w-8">{t(lang, "purchase.th_qty", "Qty")}</td>
              <td className="border-r border-slate-800 p-1 w-12">{t(lang, "pdfui.eip_u_price", "U. Price")}</td>
              <td className="border-r border-slate-800 p-1 w-14">{t(lang, "purchase.th_amount", "Amount")}</td>
              <td className="border-r border-slate-800 p-1 w-8">{t(lang, "lpjr.col_cur", "Cur")}</td>
              <td className="border-r border-slate-800 p-1 w-6">{t(lang, "money_exchange.op_label", "Op")}</td>
              <td className="border-r border-slate-800 p-1 w-12">{t(lang, "purchase.th_rate", "Rate")}</td>
              <td className="border-r border-slate-800 p-1 w-14">{t(lang, "purchase.th_final", "Final")}</td>
              <td className="border-r border-slate-800 p-1 w-10">{t(lang, "pdfui.eip_tax_percent", "Tax %")}</td>
              <td className="border-r border-slate-800 p-1 w-12">{t(lang, "pdfui.eip_tax_amt", "Tax Amt")}</td>
              <td className="p-1 w-16 text-right">{t(lang, "common.total", "Total")}</td>
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
              <td className="border-r border-slate-800 p-1 font-bold text-right uppercase" colSpan={2}>{t(lang, "pdfui.eip_grand_total_incl_tax", "Grand Total (Incl. Tax)")}</td>
              <td className="border-r border-slate-800 p-1 font-bold text-center">{totalQty}</td>
              <td className="border-r border-slate-800 p-1 text-right font-bold" colSpan={8}></td>
              <td className="p-1 font-black text-right text-[11px] text-slate-900">{grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Total In Words Row */}
        <div className="border-t border-slate-800 border-b border-slate-800 p-2 bg-slate-50">
          <p className="text-[10px]"><span className="font-bold">{t(lang, "pdfui.eip2_rs", "Rs.")}</span> <span className="uppercase font-medium italic">{numberToWords(grandTotal)}</span></p>
        </div>

        {/* Footer Area */}
        <div className="flex h-32">
          {/* Terms */}
          <div className="w-1/3 border-r border-slate-800 p-2">
            <p className="font-bold text-[10px]">{t(lang, "pdfui.eip_terms_and_conditions", "Terms and Conditions")}</p>
            <p className="text-[9px] mt-1">{t(lang, "pdfui.eip2_eoe", "E. & O.E.")}</p>
            <ol className="list-decimal pl-3 mt-1 text-[8px] text-slate-600 leading-tight">
              <li>{t(lang, "pdfui.eip2_goods_sold_not_taken_back", "Goods once sold will not be taken back.")}</li>
              <li>{t(lang, "pdfui.eip2_late_payment_interest", "Late payment may attract interest as per the agreed terms.")}</li>
              <li>{t(lang, "pdfui.eip2_subject_local_jurisdiction", "Subject to local jurisdiction only.")}</li>
            </ol>
          </div>
          
          {/* Bank / beneficiary — only rendered when the branch has real bank details */}
          <div className="w-1/3 border-r border-slate-800 p-2 flex flex-col justify-center items-center">
            {hasBank ? (
              <div className="text-[9px] w-full pl-2">
                {bankAccountNo && <p><strong>{t(lang, "acct.apv_account_number_colon", "Account Number:")}</strong> {bankAccountNo}</p>}
                {bankName && <p><strong>{t(lang, "purchase.f_bank", "Bank:")}</strong> {bankName}</p>}
                {bankIfsc && <p><strong>{t(lang, "pdfui.eip2_ifsc_colon", "IFSC:")}</strong> {bankIfsc}</p>}
                {bankBranch && <p><strong>{t(lang, "purchase.branch_colon_label", "Branch:")}</strong> {bankBranch}</p>}
              </div>
            ) : (
              <p className="text-[9px] text-slate-400 italic">{t(lang, "pdfui.eip2_no_bank_configured", "Bank details not configured")}</p>
            )}
          </div>

          {/* Signature */}
          <div className="w-1/3 p-2 flex flex-col relative">
            <p className="font-bold text-[10px] text-right">{t(lang, "pdfui.eip2_for_prefix", "For")} {brandName || t(lang, "pdfui.eip2_expenses_bill_heading", "Expenses Bill")}</p>
            <div className="mt-auto text-[10px] text-right font-bold">
              {t(lang, "pdfui.eip2_signature", "Signature")}
            </div>
          </div>
        </div>

      </div>
      <div className="text-center mt-2 text-[9px] text-blue-600">
        {t(lang, "pdfui.eip2_created_by_system", "Generated by the ERP system")}
      </div>
    </div>
  );
}
