"use client";

import React, { useState } from "react";
import { Eye, Printer, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t as tUi } from "@/lib/i18n/ui";
import { translateHeader } from "@/lib/i18n/table-headers";
import { printDomFragmentViaModal } from "@/lib/reports/print-dom-fragment";
import { InvoiceDocumentView } from "@/components/invoices/invoice-document-view";
import { SalesBookingDocumentView } from "./sales-booking-document-view";
import { SalesBookingTransferReport } from "./sales-booking-transfer-report";
import { SalesBookingContract } from "./sales-booking-contract";

export function SalesBookingStep5({
  form, goodsEntries = [], lang = "en", onBack, onSaveDraft, onPreviewPdf,
  onTransfer, onConfirmTransfer, transferConfirmation, useTransferReport = false, isTransferred = false, savingOrder = false,
}) {
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [transferReview, setTransferReview] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [showConversion, setShowConversion] = useState(true);
  const tr = label => translateHeader(lang, label);
  const title = tUi(lang, "sales.booking_order_title", "Sales Booking Order");
  const transfer = onTransfer || onConfirmTransfer;
  const status = isTransferred
    ? tUi(lang, "sales.transferred_status_word", "Transferred")
    : tUi(lang, "sales.pending_transfer_status_word", "Pending Transfer");
  const openTransferReview = () => {
    setTransferError("");
    setTransferReview(true);
  };
  const confirmTransfer = async () => {
    setTransferError("");
    try {
      await transfer();
    } catch (error) {
      setTransferError(error.message);
    }
  };
  const documentOrder = { sales_order_no: transferConfirmation?.salesOrderNo || form.salesOrderNo, form_data: { form, goodsEntries } };
  const preview = () => {
    if (useTransferReport) setDocumentOpen(true);
    else setViewOpen(true);
    onPreviewPdf?.();
  };

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(230px,310px)_minmax(0,1fr)]">
      <section aria-labelledby="sales-booking-step5-document" className="min-w-0 rounded-xl border bg-card">
        <h4 id="sales-booking-step5-document" className="rounded-t-xl bg-[#09274c] px-3 py-2 text-sm font-bold text-white">{title}</h4>
        <div className="space-y-3 p-3">
          <dl className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["Booking No", form.salesOrderNo], ["Customer Account (DR)", form.customerAccountName],
              ["Payment Type", form.paymentType], ["Status", status],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-md border p-2">
                <dt className="text-muted-foreground">{tr(label)}</dt><dd className="break-words font-semibold"><bdi>{value || "—"}</bdi></dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
            <span>{tr("Sales Contract")}<br /><bdi>{form.salesContractNo || form.salesOrderNo || "—"}</bdi></span>
            <Button type="button" variant="outline" size="sm" onClick={preview}>
              <Eye className="h-4 w-4" aria-hidden="true" />{tUi(lang, "common.view", "View")}
            </Button>
          </div>
          <Button type="button" className="w-full" disabled={!transfer || savingOrder || isTransferred} onClick={useTransferReport ? openTransferReview : transfer}>
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
            {isTransferred ? status : tUi(lang, "nav.sales_transfer_payment", "Sales Transfer Payment")}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onBack}>{tr("Back")}</Button>
            <Button type="button" variant="outline" size="sm" disabled={!onSaveDraft} onClick={onSaveDraft}>{tr("Save Draft")}</Button>
          </div>
        </div>
      </section>
      {useTransferReport && <SalesBookingTransferReport
        open={transferReview} onClose={() => setTransferReview(false)} form={form} goods={goodsEntries}
        confirmation={transferConfirmation} busy={savingOrder} lang={lang} error={transferError} onPost={confirmTransfer}
        onDocument={() => { setTransferReview(false); setDocumentOpen(true); }}
      />}
      {useTransferReport && <SalesBookingDocumentView
        open={documentOpen} onClose={() => setDocumentOpen(false)} lang={lang}
        order={documentOrder}
        onInvoice={() => { setDocumentOpen(false); setInvoiceOpen(true); }}
      />}
      {invoiceOpen && <InvoiceDocumentView
        isOpen onClose={() => { setInvoiceOpen(false); setDocumentOpen(true); }} source="sales_order"
        record={documentOrder} title={tr("Sales Booking Invoice")} companyId={form.salesCompanyId || null}
        scope={{ countryBranchId: form.countryBranchId || null, cityBranchId: form.cityBranchId || null, countryName: form.countryName || null, branchName: form.branchName || null }}
      />}
      <section className="min-w-0 rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl bg-blue-50 p-3 dark:bg-slate-800">
          <h3 className="text-sm font-bold">{tr("Sales Contract")}</h3>
          {viewOpen && <Button type="button" variant="outline" size="sm"
            onClick={() => printDomFragmentViaModal("sales-booking-contract-print", tr("Sales Contract"), { lang, orientation: "portrait" })}>
            <Printer className="h-4 w-4" aria-hidden="true" />{tUi(lang, "common.print", "Print")} / PDF
          </Button>}
        </div>
        {viewOpen && <div className="space-y-3 bg-slate-100 p-3 dark:bg-slate-950">
          <label className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={showConversion} onChange={event => setShowConversion(event.target.checked)} />
            {tr("Exchange Rate")} / {tr("Final Amount")}
          </label>
          <SalesBookingContract form={form} goodsEntries={goodsEntries} lang={lang} showConversion={showConversion} />
        </div>}
      </section>
    </div>
  );
}
