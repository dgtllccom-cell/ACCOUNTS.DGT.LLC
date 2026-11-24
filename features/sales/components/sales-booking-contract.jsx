"use client";

import React from "react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { getBookingCurrencies } from "@/lib/sales/booking-currencies";

export function SalesBookingContract({ form, goodsEntries, lang, showConversion }) {
  const tr = label => translateHeader(lang, label);
  const { sales, final } = getBookingCurrencies(form);
  const format = (value, unit, digits = 2) => value == null || value === "" || !Number.isFinite(Number(value))
    ? "—"
    : [Number(value).toLocaleString(lang, { maximumFractionDigits: digits }), unit].filter(Boolean).join(" ");
  const reports = [
    ["Loading & Receiving", [form.loadingPort, form.receivedPort, form.loadingType, form.containerType], form.loadingReport],
    ["Payment Details", [form.paymentType, form.paymentDate], form.paymentReport],
    ["Goods Summary", [], form.orderReportRemarks],
    ["Notify Party", [form.notifyPartyName], form.notifyPartyReport],
  ];
  const heading = "border-b-2 border-amber-500 bg-[#09274c] p-2 text-sm font-bold text-white";
  const cell = "break-words border border-slate-300 px-1.5 py-2 text-start align-top";
  const labels = ["Goods Name", "Quantity", "Gross Weight", "Unit Price", "Total Sales Amount",
    ...(showConversion ? ["Exchange Rate", "Final Amount"] : [])];

  return (
    <div id="sales-booking-contract-print" className="space-y-5 text-slate-900">
      <article className="space-y-3 rounded-md border border-slate-300 bg-white p-4">
        <p className="text-lg font-bold">{form.branchCompanyName || form.salesCompanyName || form.branchName || "DGT ERP"}</p>
        <h2 className={heading}>{tr("Sales Contract")}</h2>
        <p className="text-xs"><bdi>{[form.salesOrderNo, form.salesContractNo, form.billNo, form.salesDate].filter(Boolean).join(" · ") || "—"}</bdi></p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <section className="rounded border border-slate-300 p-2"><h3 className="font-bold">{tr("Sales Account Details")}</h3>
            <p>{form.salesCompanyName || form.salesAccountName || "—"}</p><p>{form.salesCompanyAddress}</p>
          </section>
          <section className="rounded border border-slate-300 p-2"><h3 className="font-bold">{tr("Customer Account (DR)")}</h3>
            <p>{form.customerCompanyName || form.customerAccountName || "—"}</p><p>{form.customerCompanyAddress}</p>
          </section>
        </div>
        <table className="w-full table-fixed border-collapse text-[10px]">
          <thead className="bg-amber-50"><tr>{labels.map(label => <th key={label} scope="col" className={cell}>{tr(label)}</th>)}</tr></thead>
          <tbody>{goodsEntries.map((item, index) => (
            <tr key={index}>
              <td className={cell}><strong>{item.goodsName || item.productName || "—"}</strong><br />{[item.brand, item.size].filter(Boolean).join(" · ")}</td>
              <td className={cell}><bdi>{format(item.qtyNo ?? item.quantity, item.qtyName || item.unit, 3)}</bdi></td>
              <td className={cell}><bdi>{format(item.grossWeight, "kg", 3)}</bdi></td>
              <td className={cell}><bdi>{format(item.coursePrice ?? item.unitPrice, item.salesCurrency || item.currencyType || sales)}</bdi></td>
              <td className={cell}><bdi>{format(item.totalAmount, item.salesCurrency || item.currencyType || sales)}</bdi></td>
              {showConversion && <><td className={cell}><bdi>{item.exchangeRate ? `${(item.op || item.operator) === "/" ? "÷" : "×"} ${item.exchangeRate}` : "—"}</bdi></td>
                <td className={cell}><bdi>{format(item.finalAmount, item.secondaryCurrency || final)}</bdi></td></>}
            </tr>
          ))}</tbody>
        </table>
        {form.remarks && <p className="whitespace-pre-wrap text-xs">{form.remarks}</p>}
      </article>
      <article className="space-y-3 rounded-md border border-slate-300 bg-white p-4" style={{ breakBefore: "page", pageBreakBefore: "always" }}>
        <p className="text-lg font-bold">{form.branchCompanyName || form.salesCompanyName || form.branchName || "DGT ERP"}</p>
        <h2 className={heading}>{tr("Final Review & Reports")}</h2>
        <p className="text-xs"><bdi>{[form.salesOrderNo, form.salesContractNo].filter(Boolean).join(" · ") || "—"}</bdi></p>
        <div className="grid grid-cols-2 gap-2">
          {reports.map(([title, values, note]) => (
            <section key={title} className="space-y-1 rounded border border-slate-300 p-2 text-xs">
              <h3 className="font-bold">{tr(title)}</h3>
              <p>{values.filter(Boolean).join(" · ")}</p>
              <p className="whitespace-pre-wrap break-words">{note || "—"}</p>
            </section>
          ))}
        </div>
        {form.salesReportRemarks && <p className="whitespace-pre-wrap text-xs">{form.salesReportRemarks}</p>}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {["Customer Account (DR)", "Sales Account Details"].map(label => (
            <section key={label} className="min-h-24 rounded border border-slate-300 p-2">
              <h3 className="font-bold">{tr(label)}</h3>
              <p className="mt-7 border-t border-slate-300 pt-1">{tr("Signature")} / {tr("Date")}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
