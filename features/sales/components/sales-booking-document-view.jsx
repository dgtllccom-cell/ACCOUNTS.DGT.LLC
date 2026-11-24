"use client";

import React, { useRef, useState } from "react";
import { Download, FileText, Mail, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { translateHeader } from "@/lib/i18n/table-headers";
import { getBookingCurrencies } from "@/lib/sales/booking-currencies";

function DocumentSection({ title, children, rows }) {
  return (
    <section className="break-inside-avoid rounded border border-blue-300">
      <h3 className="bg-blue-950 px-2 py-1 font-bold text-white">{title}</h3>
      {rows && <dl className="divide-y divide-blue-100 px-2 py-1">
        {rows.map(([label, value]) => <div key={label} className="grid grid-cols-2 gap-2 py-0.5">
          <dt className="font-semibold">{label}</dt><dd className="break-words"><bdi>{value ?? "—"}</bdi></dd>
        </div>)}
      </dl>}
      {children}
    </section>
  );
}

export function SalesBookingDocumentView({ open, onClose, onInvoice, order = {}, lang = "en", busy = false, error = "" }) {
  const pages = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const tr = label => translateHeader(lang, label);
  const title = tr("Sales Booking – View / PDF Preview");
  const form = order.form_data?.form || {};
  const goods = Array.isArray(order.form_data?.goodsEntries) ? order.form_data.goodsEntries : [];
  const { sales, final, rate } = getBookingCurrencies(form);
  const booking = order.sales_order_no || form.salesOrderNo;
  const hasDocument = Boolean(booking || goods.length || form.salesAccountName || form.customerAccountName);
  const filename = `Sales-Booking-${String(booking || "").replace(/[^a-z0-9_-]/gi, "")}.pdf`;
  const total = key => goods.reduce((sum, line) => sum + (Number(line[key]) || 0), 0);
  const qty = goods.reduce((units, line) => {
    const unit = line.qtyName || line.unit || "";
    units.set(unit, (units.get(unit) || 0) + (Number(line.qtyNo ?? line.quantity) || 0));
    return units;
  }, new Map());
  const number = value => value == null || value === "" || !Number.isFinite(Number(value)) ? "—" : new Intl.NumberFormat(lang, { maximumFractionDigits: 4 }).format(Number(value));
  const money = (value, currency) => value == null ? "—" : `${currency} ${number(value)}`;
  const quantity = [...qty].map(([unit, amount]) => `${number(amount)} ${unit}`.trim()).join(" / ") || "—";
  const originalAmount = order.total_goods_original ?? total("totalAmount");
  const finalAmount = order.order_total ?? total("finalAmount");
  const company = form.branchCompanyName || form.salesCompanyName || form.salesAccountName || order.branch_name || form.branchName;
  const pad = value => value || "—";
  const section = (heading, rows) => <DocumentSection title={tr(heading)} rows={rows.map(([label, value]) => [tr(label), value === "" ? null : value])} />;
  const refs = [["Contract No.", form.salesContractNo || order.sales_contract_no], ["Invoice No.", form.invoiceNo || form.billNo], ["Booking No.", booking], ["Serial No.", order.branch_transaction_serial_number || form.bookingSerials?.branchTransactionSerialNumber], ["Date", form.salesDate || order.order_date]];
  const header = heading => (
    <header className="space-y-2 text-center">
      <div className="border-b-2 border-blue-900 pb-2">
        <div className="text-xl font-black text-blue-950">{pad(company)}</div>
        <div className="font-bold">{pad(form.branchName || order.branch_name)}</div>
        <div>{[form.branchCompanyAddress || form.salesCompanyAddress, form.branchPhone, form.branchEmail].filter(Boolean).join(" · ")}</div>
      </div>
      <h2 className="rounded bg-blue-100 px-2 py-1 text-base font-black uppercase text-blue-950">{tr(heading)}</h2>
      <dl className="grid grid-cols-5 divide-x rounded border border-blue-200 bg-blue-50 p-1">
        {refs.map(([label, value]) => <div key={label} className="break-words px-1"><dt className="font-semibold">{tr(label)}</dt><dd className="font-bold"><bdi>{pad(value)}</bdi></dd></div>)}
      </dl>
    </header>
  );
  const footer = page => <footer className="flex justify-between border-t border-blue-900 pt-2 text-[10px] font-semibold"><span>{tr("Sales Booking Report")}</span><span>{tr("Page")} {page} / 2</span></footer>;
  const box = "min-w-0 space-y-3 rounded bg-white p-4 text-[11px] leading-snug text-slate-900 shadow-md";
  const cell = "border border-blue-200 px-1.5 py-1 text-start";
  const dir = ["ur", "ar", "fa", "ps"].includes(lang) ? "rtl" : "ltr";

  const print = () => {
    if (!pages.current) return;
    const frame = document.createElement("iframe");
    frame.title = title;
    frame.style.cssText = "position:fixed;width:0;height:0;border:0";
    frame.onload = () => {
      const printWindow = frame.contentWindow;
      if (!printWindow) { frame.remove(); return; }
      printWindow.addEventListener("afterprint", () => frame.remove(), { once: true });
      printWindow.focus();
      printWindow.print();
    };
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"],style')).map(node => node.outerHTML).join("");
    frame.srcdoc = `<!doctype html><html dir="${dir}"><head><meta charset="utf-8">${styles}<style>@page{size:A4 portrait;margin:9mm}html,body{margin:0;background:white!important}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}article{box-shadow:none!important}article+article{break-before:page}table{width:100%;border-collapse:collapse}tr{break-inside:avoid}</style></head><body>${pages.current.innerHTML}</body></html>`;
    document.body.appendChild(frame);
  };

  const exportPdf = async share => {
    if (!pages.current || exporting) return;
    setExportError("");
    setExporting(true);
    const clone = document.createElement("div");
    clone.dir = dir;
    clone.style.cssText = "width:192mm;background:white";
    clone.innerHTML = pages.current.innerHTML;
    const articles = clone.querySelectorAll("article");
    articles.forEach(page => { page.style.boxShadow = "none"; });
    if (articles[1]) articles[1].style.breakBefore = "page";
    try {
      const { default: html2pdf } = await import("html2pdf.js");
      await html2pdf().set({
        margin: 9, filename, pagebreak: { mode: ["css", "legacy"] },
        html2canvas: { scale: 2, backgroundColor: "#ffffff", logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
      }).from(clone).save();
      const message = encodeURIComponent(`${tr("Sales Booking Report")} ${booking || ""}\n${tr("Attach the downloaded PDF.")}`);
      if (share === "email") window.location.href = `mailto:?subject=${encodeURIComponent(booking || tr("Sales Booking"))}&body=${message}`;
      if (share === "whatsapp") window.open(`https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
    } catch {
      setExportError(tr("PDF generation failed. Please use Print to save the PDF."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none bg-slate-200 p-0 [&>button]:text-white">
        <div dir={dir} className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 px-4 py-3 pe-12 text-white">
          <DialogTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5" />{title}</DialogTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!hasDocument || busy} onClick={print}><Printer />{tr("Print")}</Button>
            <Button size="sm" variant="secondary" disabled={!hasDocument || busy || exporting} onClick={() => void exportPdf()}><Download />{tr("Download PDF")}</Button>
            {onInvoice && <Button size="sm" variant="secondary" disabled={busy} onClick={onInvoice}><FileText />{tr("Invoice")}</Button>}
            <Button size="sm" variant="secondary" disabled={!hasDocument || busy || exporting} onClick={() => void exportPdf("email")}><Mail />{tr("Email")}</Button>
            <Button size="sm" variant="secondary" className="text-emerald-800" disabled={!hasDocument || busy || exporting} onClick={() => void exportPdf("whatsapp")}><Share2 />WhatsApp</Button>
          </div>
        </div>
        {(error || exportError) && <p role="alert" className="bg-red-50 p-3 text-red-800">{error || exportError}</p>}
        {busy && <p role="status" className="p-4 text-slate-700">{tr("Loading...")}</p>}
        {!busy && !error && <div className="flex-1 overflow-auto p-3">
          <div ref={pages} dir={dir} className="mx-auto grid max-w-[1550px] items-start gap-3 lg:grid-cols-2">
            <article className={box}>
              {header("Sales Contract / Booking Report")}
              <div className="grid grid-cols-2 gap-2">
                {section("Seller / Exporter", [["Account Name", form.salesCompanyName || form.salesAccountName], ["Address", form.salesCompanyAddress], ["Account No.", form.salesAccountNo]])}
                {section("Buyer / Consignee", [["Account Name", form.customerCompanyName || form.customerAccountName || order.customer_name], ["Address", form.customerCompanyAddress], ["Place of Delivery", form.receivedPort || form.receivingPort], ["Final Destination", form.destinationCountry || form.receivedCountry]])}
              </div>
              {section("Contract Details", [["Booking Date", form.salesDate || order.order_date], ["Payment Terms", form.paymentTerms || form.paymentDaysAndMethodDetails], ["Ship Type", form.shippingMode], ["Sales Currency", sales], ["Exchange Rate", rate.ok ? `${sales} ${rate.operator === "/" ? "÷" : "×"} ${rate.rate} → ${final}` : null]])}
              <DocumentSection title={tr("Goods Details")}>
                <table className="w-full border-collapse">
                  <thead className="bg-blue-100"><tr>{["#", "Goods Name", "Specification / Grade", "Quantity", "Packing", "Unit Price", "Amount"].map(label => <th key={label} scope="col" className={cell}>{tr(label)}</th>)}</tr></thead>
                  <tbody>{goods.map((line, i) => <tr className="break-inside-avoid" key={i}>
                    {[i + 1, line.goodsName || line.productName, [line.size, line.grade, line.hsCode].filter(Boolean).join(" / "), `${number(line.qtyNo ?? line.quantity)} ${line.qtyName || line.unit || ""}`, line.packType, money(line.coursePrice ?? line.unitPrice, sales), money(line.totalAmount, sales)].map((value, column) => <td className={cell} key={column}><bdi>{pad(value)}</bdi></td>)}
                  </tr>)}</tbody>
                  <tfoot className="bg-amber-50 font-bold"><tr><th scope="row" colSpan={3} className={cell}>{tr("Total")}</th><td className={cell}>{quantity}</td><td colSpan={3} className={cell}>{money(originalAmount, sales)}</td></tr></tfoot>
                </table>
              </DocumentSection>
              {section("Commercial Terms & Conditions", [["Payment Terms", form.paymentTerms || form.paymentDaysAndMethodDetails], ["Shipment Terms", form.shippingTerms || form.deliveryType], ["Remarks", form.remarks]])}
              {footer(1)}
            </article>
            <article className={box}>
              {header("Contract Report & Annexure")}
              <div className="grid grid-cols-2 gap-2">
                {section("Loading & Shipping Report", [["Loading Country", form.loadingCountry], ["Loading Port", form.loadingPort], ["Loading Date", form.loadingDate], ["Shipping Line", form.shippingLine], ["Vessel Name", form.vesselName], ["Voyage No.", form.voyageNo]])}
                {section("Goods Summary Report", [["Total Items", goods.length], ["Total Quantity", quantity], ["Total Gross Weight", `${number(total("grossWeight"))} kg`], ["Total Net Weight", `${number(total("netWeight"))} kg`], ["Total Amount", money(originalAmount, sales)], ["Final Amount", money(finalAmount, final)]])}
                {section("Payment & Settlement Report", [["Payment Type", form.paymentType], ["Advance Percentage", form.advancePercent == null ? null : `${form.advancePercent}%`], ["Advance Amount", money(form.advanceAmount, final)], ["Advance Date", form.advancePaymentDate], ["Final Payment Date", form.paymentDate], ["Remaining Amount", money(order.remaining_amount, final)]])}
                <DocumentSection title={tr("Final Report / Journal Narration")}><p className="whitespace-pre-wrap break-words p-2">{pad(form.salesReportRemarks || form.orderReportRemarks)}</p></DocumentSection>
              </div>
              <DocumentSection title={tr("Report / Remarks")}><p className="whitespace-pre-wrap break-words p-2">{[form.loadingReport, form.paymentReport, form.notifyPartyReport].filter(Boolean).join("\n\n") || "—"}</p></DocumentSection>
              <div className="grid grid-cols-2 gap-2">
                {["Buyer Signature", "Seller Signature & Stamp"].map(label => <DocumentSection key={label} title={tr(label)}><div className="min-h-24 p-2"><p>{tr("Name")} ____________________</p><p className="mt-2">{tr("Date")} ____________________</p></div></DocumentSection>)}
              </div>
              {footer(2)}
            </article>
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  );
}
