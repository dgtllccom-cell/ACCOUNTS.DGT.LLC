"use client";

import React, { useState } from "react";
import { CreditCard, Download, FileText, Package, Printer, Save, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translateHeader } from "@/lib/i18n/table-headers";
import { getBookingCurrencies } from "@/lib/sales/booking-currencies";
import { SalesBookingGoodsReport } from "./sales-booking-goods-report";

const steps = ["Booking Details", "Goods Entry Details", "Shipping & Payment", "Final Review & Reports", "Final Report"];
const notifyFields = [["Party Name", "notifyParty"], ["Phone", "notifyPartyPhone"],
  ["Email", "notifyPartyEmail"], ["Address", "notifyPartyAddress"]];
const inputClass = "w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export function SalesBookingStep4({ form, setForm, goodsEntries = [], lang = "en", onNext, onBack, onSaveDraft, onPrint, onDownloadPdf }) {
  const [viewing, setViewing] = useState({});
  const tr = label => translateHeader(lang, label);
  const update = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const { sales, final, rate } = getBookingCurrencies(form);
  const salesAmounts = new Map();
  const finalAmounts = new Map();
  const quantities = new Map();
  let grossWeight = 0;
  let netWeight = 0;
  for (const item of goodsEntries) {
    const unit = item.qtyName || item.unit || "";
    const salesCode = item.salesCurrency || item.currencyType || sales;
    const finalCode = item.secondaryCurrency || final;
    quantities.set(unit, (quantities.get(unit) || 0) + Number(item.qtyNo ?? item.quantity ?? 0));
    if (item.totalAmount != null) salesAmounts.set(salesCode, (salesAmounts.get(salesCode) || 0) + Number(item.totalAmount));
    if (item.finalAmount != null) finalAmounts.set(finalCode, (finalAmounts.get(finalCode) || 0) + Number(item.finalAmount));
    grossWeight += Number(item.grossWeight ?? 0);
    netWeight += Number(item.netWeight ?? 0);
  }
  const number = (value, digits = 3) => Number(value).toLocaleString(lang, { maximumFractionDigits: digits });
  const amount = (value, code) => [code, Number(value).toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })].filter(Boolean).join(" ");
  const summarize = values => Array.from(values, ([code, value]) => amount(value, code)).join(" · ");
  const fx = rate.ok ? `${rate.operator === "/" ? "÷" : "×"} ${rate.rate}` : "";
  const plannedAdvance = salesAmounts.size === 1 && form.advancePercent != null && form.advancePercent !== ""
    ? Number(form.advancePercent) : null;
  const salesValue = salesAmounts.get(sales);
  const advance = plannedAdvance == null || salesValue == null ? null : salesValue * plannedAdvance / 100;

  const reports = [
    { title: "Loading & Receiving", notes: "Loading Report", field: "loadingReport", Icon: Truck, color: "bg-blue-50 text-blue-950 dark:bg-blue-950 dark:text-blue-100",
      rows: [["Loading Country", form.loadingCountry], ["Loading Port", form.loadingPort || form.salesPortOfLoading],
        ["Loading Date", form.loadingDate], ["Receiving Country", form.receivedCountry || form.receivingCountry || form.destinationCountry],
        ["Receiving Port", form.receivedPort || form.receivingPort || form.salesPortOfDischarge],
        ["Receiving Date", form.receivedDate || form.receivingDate], ["Bill of Lading", form.blNo || form.billOfLadingNo]] },
    { title: "Payment Details", notes: "Payment Report", field: "paymentReport", Icon: CreditCard, color: "bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100",
      rows: [["Sales Amount", summarize(salesAmounts)], ["Final Amount", summarize(finalAmounts)], ["Exchange Rate", fx],
        ["Advance Amount", advance == null ? null : amount(advance, sales)],
        ["Remaining Amount", advance == null ? null : amount(salesValue - advance, sales)], ["Payment Type", form.paymentType],
        ["Payment Condition", form.paymentCondition || form.paymentTerms]] },
    { title: "Goods Summary", notes: "Goods Report", field: "orderReportRemarks", Icon: Package, color: "bg-orange-50 text-orange-950 dark:bg-orange-950 dark:text-orange-100",
      rows: [["Total Qty", Array.from(quantities, ([unit, value]) => [number(value), unit].filter(Boolean).join(" ")).join(" · ")],
        ["Net Weight", goodsEntries.length ? `${number(netWeight)} kg` : ""], ["Gross Weight", goodsEntries.length ? `${number(grossWeight)} kg` : ""],
        ["Origin", [...new Set(goodsEntries.map(item => item.origin).filter(Boolean))].join(", ")]] },
    { title: "Notify Party", notes: "Notify Party Report", field: "notifyPartyReport", Icon: Users, color: "bg-violet-50 text-violet-950 dark:bg-violet-950 dark:text-violet-100",
      rows: notifyFields.map(([label, key]) => [label, form[key]]) },
  ];
  const metadata = [["Booking No", form.salesOrderNo], ["Status", tr(form.salesStatus)], ["Booking Date", form.salesDate],
    ["Contract No", form.salesContractNo], ["Serial No", form.billNo]];

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-blue-950 px-4 py-3 text-white">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <FileText className="h-5 w-5" aria-hidden="true" />{tr("Final Review & Reports")}
        </h3>
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(180px,225px)_minmax(0,1fr)]">
        <aside className="space-y-3 print:hidden">
          <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <h4 className="mb-2 text-xs font-bold">{tr("Process Status")}</h4>
            <ol className="space-y-1 text-xs">
              {steps.map((step, index) => (
                <li key={step} aria-current={index === 3 ? "step" : undefined}
                  className={index === 3 ? "rounded-md bg-blue-100 p-1.5 font-bold text-blue-950 dark:bg-blue-950 dark:text-blue-100" : "p-1.5"}>
                  {index + 1}. {tr(step)}
                </li>
              ))}
            </ol>
          </section>
          <section className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-xs font-bold">{tr("Booking Actions")}</h4>
            <a href="#sales-booking-voucher-root" className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-700">
              {tr("View Booking")}
            </a>
            <Button type="button" variant="outline" onClick={onBack} className="justify-start text-xs">{tr("Back to Step 3")}</Button>
          </section>
        </aside>

        <div id="sales-booking-voucher-root" className="min-w-0 space-y-3">
          <dl className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
            {metadata.map(([label, value]) => (
              <div key={label} className="flex gap-1.5">
                <dt>{tr(label)}</dt><dd className="font-semibold"><bdi>{value || "—"}</bdi></dd>
              </div>
            ))}
          </dl>
          <SalesBookingGoodsReport form={form} goodsEntries={goodsEntries} lang={lang} showOrigin />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {reports.map(({ title, notes, field, Icon, color, rows }) => (
              <section key={field} className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <h4 className={`flex items-center gap-2 rounded-t-xl p-2.5 text-sm font-bold ${color}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{tr(title)}
                </h4>
                <div className="flex flex-1 flex-col gap-2 p-2.5">
                  <dl className="flex-1 space-y-1.5 text-xs">
                    {rows.map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-2">
                        <dt className="min-w-0">{tr(label)}</dt>
                        <dd className="min-w-0 break-words text-end font-semibold"><bdi>{value || "—"}</bdi></dd>
                      </div>
                    ))}
                  </dl>
                  {field === "notifyPartyReport" && (
                    <details className="rounded border border-slate-200 p-2 text-xs dark:border-slate-700 print:hidden">
                      <summary className="cursor-pointer">{tr("Edit")}</summary>
                      <div className="mt-2 grid gap-2">
                        {notifyFields.map(([label, key]) => (
                          <label key={key} className="grid gap-1">{tr(label)}
                            <input className={inputClass} value={form[key] || ""} onChange={event => update(key, event.currentTarget.value)} />
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                  <label htmlFor={viewing[field] ? undefined : `sales-review-${field}`}
                    className="rounded bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                    {tr(notes)}
                  </label>
                  {viewing[field] ? (
                    <p className="min-h-16 whitespace-pre-wrap break-words text-xs">{form[field] || "—"}</p>
                  ) : (
                    <textarea id={`sales-review-${field}`} rows={3} value={form[field] || ""} className={inputClass}
                      onChange={event => update(field, event.currentTarget.value)} />
                  )}
                  <div className="flex justify-end gap-2 print:hidden">
                    <Button type="button" variant="outline" size="sm" onClick={() => setViewing(previous => ({ ...previous, [field]: !previous[field] }))}>
                      {tr(viewing[field] ? "Edit" : "View")}
                    </Button>
                    <Button type="button" size="sm" disabled={!onSaveDraft} onClick={onSaveDraft} className="bg-emerald-700 text-white">{tr("Save Draft")}</Button>
                  </div>
                </div>
              </section>
            ))}
          </div>
          <label className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold dark:border-slate-800 dark:bg-slate-900">
            {tr("Final Sales Remarks")}
            <textarea rows={2} value={form.salesReportRemarks || ""} className={inputClass}
              onChange={event => update("salesReportRemarks", event.currentTarget.value)} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button type="button" variant="outline" onClick={onBack}>{tr("Back to Step 3")}</Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!onSaveDraft} onClick={onSaveDraft}><Save className="h-4 w-4" />{tr("Save Draft")}</Button>
          <Button type="button" variant="outline" onClick={onPrint}><Printer className="h-4 w-4" />{tr("Print")}</Button>
          <Button type="button" variant="outline" onClick={onDownloadPdf}><Download className="h-4 w-4" />{tr("Download PDF")}</Button>
          <Button type="button" onClick={onNext} className="bg-emerald-700 text-white">{tr("Next: Final Report")}</Button>
        </div>
      </div>
    </div>
  );
}
