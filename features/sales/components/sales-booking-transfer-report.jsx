"use client";

import React, { useId } from "react";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Banknote, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { translateHeader } from "@/lib/i18n/table-headers";
import { printDomFragmentViaModal } from "@/lib/reports/print-dom-fragment";
import { bookingScopeSerials, groupExactSerials } from "@/lib/sales/sales-transfer-serials";
import { salesPaymentTransferReport } from "@/lib/sales/payment-transfer-report";
import { SalesTransferScopeSerials } from "./sales-transfer-scope-serials";
import { salesWorkflowDestination } from "@/lib/sales/payment-workflow";
import { isLocalSalesFormData } from "@/lib/sales/local-sales-source";
import { getBookingCurrencies } from "@/lib/sales/booking-currencies";

function ReportSection({ title, entries, children, className = "", green = false }) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white ${className}`}>
      <h3 className={`px-3 py-1.5 text-xs font-black uppercase ${green ? "bg-emerald-700 text-white" : "bg-gradient-to-r from-blue-200 to-blue-50 text-blue-950"}`}>{title}</h3>
      {entries && <dl className="divide-y divide-slate-200 px-3 py-1">
        {entries.map(([label, value, printOnly]) => (
          <div key={label} hidden={printOnly || undefined} style={printOnly ? { display: "none" } : undefined} data-print-only={printOnly ? "" : undefined} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 py-1">
            <dt className="font-semibold text-slate-600">{label}</dt>
            <dd className="break-words font-bold"><bdi>{value ?? "—"}</bdi></dd>
          </div>
        ))}
      </dl>}
      {children}
    </section>
  );
}

export function SalesBookingTransferReport({
  open, onClose, form = {}, goods = [], order = {}, confirmation, busy = false, error, onPost, onDocument, lang = "en", localSale = false,
}) {
  const printId = useId();
  const tr = label => translateHeader(lang, label);
  const title = tr(localSale ? "Local Sales Transfer Verification Report" : "Sales Booking Transfer Verification Report");
  const data = order.form_data || {};
  const trace = confirmation?.transferVerification || data.transferVerification || {};
  const audit = form.transferAudit || {};
  const posted = [confirmation?.ledgerPostingStatus, order.ledger_posting_status].includes("posted");
  const transferred = posted || order.ledger_posting_status === "transferred" || data.workflow?.transferStatus === "transferred";
  const status = posted ? tr("Transferred / Completed") : transferred ? tr("Transferred") : tr("Awaiting Transfer");
  const journalId = trace.journalId || data.lastPaymentTrace?.roznamchaEntryId;
  const journalScope = order.city_branch_id || form.cityBranchId ? "branch"
    : order.country_branch_id || order.country_id || form.countryBranchId || form.countryId ? "country" : "super-admin";
  const journalUrl = posted && journalId ? `/dashboard/roznamcha/${journalScope}?entryId=${encodeURIComponent(journalId)}` : null;
  const { sales, final, rate } = getBookingCurrencies(form);
  const number = (value, digits = 2) => value == null || value === "" || !Number.isFinite(Number(value))
    ? "—" : new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(Number(value));
  const money = (value, currency) => value == null ? "—" : `${currency} ${number(value)}`;
  const sum = key => goods.reduce((total, item) => total + (Number(item[key]) || 0), 0);
  const finalAmount = order.order_total ?? (goods.length ? sum("finalAmount") : null);
  const postingReferences = groupExactSerials([["VR", trace.voucherNo], ["DR", trace.debitSerial], ["CR", trace.creditSerial]])
    .map(({ kinds, serial }) => {
      const label = kinds.length > 1 ? `${kinds.join(" / ")} ${tr("Serial No.")}`
        : tr({ VR: "VR (Voucher) Serial No.", DR: "DR Serial No.", CR: "CR Serial No." }[kinds[0]]);
      const code = <code className="break-all font-mono text-[10px] font-semibold">{serial}</code>;
      return [label, journalUrl ? <a href={journalUrl} className="text-blue-700 underline decoration-blue-200" target="_blank" rel="noreferrer">{code}</a> : code];
    });
  const booking = confirmation?.salesOrderNo || order.sales_order_no || form.salesOrderNo;
  const destination = posted ? salesWorkflowDestination(form.paymentType || form.paymentCondition, {
    orderId: confirmation?.salesOrderId || order.id,
    billNo: booking,
    local: isLocalSalesFormData({ form }),
  }) : null;
  const debit = form.customerAccountName || order.customer_name;
  const credit = form.salesAccountName;
  const debitCode = form.customerAccountNo;
  const creditCode = form.salesAccountNo;
  const section = (name, entries, props = {}) => <ReportSection title={tr(name)} entries={entries.map(([label, value, printOnly]) => [tr(label), value || value === 0 ? value : null, printOnly])} {...props} />;
  const cell = "border-b border-slate-200 px-2 py-1.5 text-start";
  const localSettlement = localSale ? salesPaymentTransferReport(order) : null;
  const debitAmount = posted && trace.debitCurrency ? money(trace.debitAmount, trace.debitCurrency) : null;
  const creditAmount = posted && trace.creditCurrency ? money(trace.creditAmount, trace.creditCurrency) : null;
  const previewSummary = [
    [ArrowDownLeft, "Customer Account (DR)", [debitCode, debit].filter(Boolean).join(" · "), debitAmount, "text-blue-700 dark:text-blue-300"],
    [ArrowUpRight, "Sales Account (CR)", [creditCode, credit].filter(Boolean).join(" · "), creditAmount, "text-violet-700 dark:text-violet-300"],
    [Banknote, "Final Amount", money(finalAmount, final), rate.ok ? `${sales} ${rate.operator === "/" ? "÷" : "×"} ${number(rate.rate, 6)} → ${final}` : null, "text-emerald-700 dark:text-emerald-300"],
  ];

  return (
    <Dialog open={open} onOpenChange={next => { if (!next && !busy) onClose(); }}>
      <DialogContent aria-describedby={undefined} dir={["ur", "ar", "fa", "ps"].includes(lang) ? "rtl" : "ltr"}
        className="flex h-[96dvh] max-w-[min(98vw,90rem)] flex-col gap-0 overflow-hidden p-0 [&>button]:text-white"
      >
        <div className="flex items-center gap-3 bg-gradient-to-r from-blue-950 to-blue-700 px-4 py-3 pe-12 text-white">
          <FileText className="size-6 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm font-extrabold sm:text-lg">{title}</DialogTitle>
            <bdi className="mt-1 inline-flex max-w-full break-all rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-100">{booking || "—"}</bdi>
          </div>
          <span className={`rounded-full px-2 py-1 text-center text-xs font-bold ${posted ? "bg-emerald-100 text-emerald-950" : "bg-amber-100 text-amber-950"}`}>{status}</span>
        </div>
        {error && <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-2.5 sm:p-4 dark:bg-slate-950">
          <dl className="mx-auto mb-3 grid max-w-6xl grid-cols-2 gap-2 lg:grid-cols-3">
            {previewSummary.map(([Icon, label, value, detail, tint]) => (
              <div key={label} className="min-w-0 rounded-lg border bg-card px-3 py-2 last:col-span-2 lg:last:col-span-1">
                <dt className={`flex items-center gap-1.5 text-xs font-bold ${tint}`}><Icon className="size-4 shrink-0" aria-hidden="true" />{tr(label)}</dt>
                <dd className="mt-1 break-words text-sm font-extrabold"><bdi>{value || "—"}</bdi></dd>
                {detail && <dd className="mt-0.5 text-xs text-muted-foreground"><bdi>{detail}</bdi></dd>}
              </div>
            ))}
          </dl>
          <div id={printId} className="mx-auto max-w-6xl space-y-3 text-xs text-slate-900" dir={["ur", "ar", "fa", "ps"].includes(lang) ? "rtl" : "ltr"}>
            <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white p-3">
              <strong className="text-lg text-blue-950">{form.branchCompanyName || form.salesCompanyName || order.branch_name || form.branchName || "—"}</strong>
              <div className="text-end"><div>{order.branch_name || form.branchName || "—"}</div><div>{order.country_name || form.countryName || form.country || "—"}</div></div>
            </header>
            <div hidden style={{ display: "none" }} data-print-only="" className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-blue-950 px-3 py-2 text-white">
              <h2 className="text-sm font-bold">{title}</h2>
              <bdi>{booking || "—"} · {form.salesDate || order.order_date || "—"}</bdi>
              <strong className={posted ? "rounded bg-emerald-700 px-2 py-1" : "rounded bg-slate-700 px-2 py-1"}>{status}</strong>
            </div>
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="grid gap-3 sm:grid-cols-2">
                {section("Booking Information", [["Sales Booking No.", booking, true], ["Booking Date", form.salesDate || order.order_date], ["Booking Type", tr(localSale ? "Local Sales" : "Sales Booking")], ["Sales Order Ref", form.salesContractNo || form.billNo]])}
                {section("Accounts (DR / CR)", [["Customer Account (DR)", debit], ["Account No. (DR)", debitCode], ["Sales Account (CR)", credit], ["Account No. (CR)", creditCode]])}
                {section("Customer / Sender (DR)", [["Account Name", debit], ["Country / Branch", [form.customerAccountCountry, form.customerAccountBranch].filter(Boolean).join(" / ")], ["Contact Person", form.customerContactPerson], ["Contact No.", form.customerPhone]])}
                {section("Receiver / Sales (CR)", [["Account Name", credit], ["Country / Branch", [form.salesAccountCountry, form.salesAccountBranch].filter(Boolean).join(" / ")], ["Contact Person", form.salesContactPerson], ["Contact No.", form.salesPhone]])}
                <ReportSection title={tr("Goods Details")} className="sm:col-span-2">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[11px]">
                      <thead className="bg-blue-50"><tr>{["#", "Goods Name", "Lot Name", "Size / Grade", "Qty (Unit)", "Gross Weight (KG)", "Net Weight (KG)", "Exchange Rate", "Sales Amount", "Final Amount"].map(label => <th className={cell} key={label} scope="col">{tr(label)}</th>)}</tr></thead>
                      <tbody>{goods.map((item, i) => (
                        <tr key={i}>{[i + 1, item.goodsName || item.productName, item.stockLotNo || item.lotNo, [item.size, item.grade].filter(Boolean).join(" / "), `${number(item.qtyNo ?? item.quantity, 3)} ${item.qtyName || item.unit || ""}`, number(item.grossWeight, 3), number(item.netWeight, 3), item.exchangeRate ? `${(item.op || item.operator) === "/" ? "÷" : "×"} ${item.exchangeRate}` : "—", money(item.totalAmount, item.salesCurrency || sales), money(item.finalAmount, item.secondaryCurrency || final)].map((value, col) => <td className={cell} key={col}><bdi>{value || "—"}</bdi></td>)}</tr>
                      ))}</tbody>
                      {goods.length > 0 && <tfoot className="bg-amber-50 font-bold">
                        <tr><th colSpan={5} className={cell} scope="row">{tr("Total")}</th><td className={cell}>{number(sum("grossWeight"), 3)}</td><td className={cell}>{number(sum("netWeight"), 3)}</td><td className={cell}>—</td><td className={cell}>{money(order.total_goods_original ?? sum("totalAmount"), sales)}</td><td className={cell}>{money(finalAmount, final)}</td></tr>
                      </tfoot>}
                    </table>
                  </div>
                </ReportSection>
                {section("Loading & Route Information", [["Loading Country", form.loadingCountry], ["Loading Port", form.loadingPort], ["Loading Date", form.loadingDate], ["Received Country", form.receivedCountry || form.receivingCountry], ["Received Port", form.receivedPort || form.receivingPort], ["Receiving Date", form.receivedDate || form.receivingDate], ["Ship Type", form.shippingMode], ["Container No.", form.containerNo]])}
                {section("Payment Information", [["Payment Type", form.paymentType], ["Payment Condition", form.paymentCondition || form.paymentTerms], ["Sales Currency", sales], ["Exchange Rate", rate.ok ? `${sales} ${rate.operator === "/" ? "÷" : "×"} ${rate.rate} → ${final}` : null], ["Final Amount", money(finalAmount, final)], ["Paid Amount", money(localSale ? localSettlement?.received : confirmation?.paidAmount ?? order.paid_amount, final)], ["Remaining Amount", money(localSale ? localSettlement?.remaining : confirmation?.remainingAmount ?? order.remaining_amount, final)], ["Payment Account", form.paymentAccountName]])}
                {section("Accounting Posting (Transfer Result)", [["Debit", debitAmount], ["Credit", creditAmount]])}
                <ReportSection title={tr("Remarks")}><p className="whitespace-pre-wrap break-words p-3">{form.salesReportRemarks || form.remarks || "—"}</p></ReportSection>
              </div>
              <aside className="grid gap-3">
                {section("Transfer & Posting Details", [
                  ["Business Ledger", posted ? tr("Posted") : "—"], ["Business Roznamcha", posted ? tr("Posted") : "—"],
                  ...postingReferences,
                  ["Transfer Date & Time", (trace.postedAt || audit.transferDate) && new Date(trace.postedAt || audit.transferDate).toLocaleString(lang, { timeZone: "Asia/Dubai" })], ["Transferred By", trace.userName || audit.userName], ["Final Status", status, true],
                ], { green: true })}
                <SalesTransferScopeSerials serials={trace.scopeSerials} booking={bookingScopeSerials(order, form)} lang={lang} />
                {section("Posting Summary", [["Debit Account", debitCode], ["Debit Amount", debitAmount], ["Credit Account", creditCode], ["Credit Amount", creditAmount], ["Final Currency", final], ["Final Amount", money(finalAmount, final)]])}
              </aside>
            </div>
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t bg-card px-3 py-2.5">
            <Button type="button" size="sm" variant="outline" onClick={() => printDomFragmentViaModal(printId, title, { lang, orientation: "portrait" })}>
              <Printer aria-hidden="true" />{tr("Print / PDF")}
            </Button>
            {onPost && !transferred && <Button type="button" size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" disabled={busy} onClick={onPost}>
              <ArrowRightLeft aria-hidden="true" />{busy ? tr("Processing...") : tr("Transfer / Post")}
            </Button>}
            {posted && onDocument && <Button type="button" size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={onDocument}>{tr("Sales Booking")}</Button>}
            {destination && <Button asChild size="sm" variant="outline"><a href={destination.href}>{tr(destination.label)}</a></Button>}
            {journalUrl && <Button asChild size="sm"><a href={journalUrl} target="_blank" rel="noreferrer">{tr("View Journal")}</a></Button>}
        </footer>
      </DialogContent>
    </Dialog>
  );
}
