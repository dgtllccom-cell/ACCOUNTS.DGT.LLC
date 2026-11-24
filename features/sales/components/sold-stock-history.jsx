"use client";

import React, { useEffect, useState, useId } from "react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { printDomFragmentViaModal } from "@/lib/reports/print-dom-fragment";
import { Button } from "@/components/ui/button";
import { SalesBookingContract } from "./sales-booking-contract";

function bookingData(value) {
  if (typeof value !== "string") return value || {};
  try { return JSON.parse(value) || {}; } catch { return {}; }
}

export function SoldStockHistory({ lot, deductions, loading, failed, lang, onBack }) {
  const tr = label => translateHeader(lang, label);
  const printId = useId();
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState(null);
  const bills = new Map();
  for (const row of deductions) {
    if (!row.posted || !row.orderId) continue;
    const old = bills.get(row.orderId);
    bills.set(row.orderId, { ...row, quantity: row.quantity + (old?.quantity ?? 0) });
  }
  const billId = bills.has(selected) ? selected : bills.keys().next().value;
  const selectedBill = bills.get(billId);
  const fmt = number => Number(number).toLocaleString(lang, { maximumFractionDigits: 3 });

  useEffect(() => {
    if (!billId) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`/api/erp/sales/orders/${encodeURIComponent(billId)}`, {
          credentials: "same-origin", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Bill could not be read");
        const body = await response.json();
        if (!body?.data?.order) throw new Error("Bill could not be read");
        if (!controller.signal.aborted) setResult({ billId, order: body.data.order });
      } catch {
        if (!controller.signal.aborted) setResult({ billId, error: true });
      }
    };
    void load();
    return () => controller.abort();
  }, [billId]);

  const current = result?.billId === billId ? result : null;
  const order = current?.order;
  const data = bookingData(order?.form_data);
  const form = {
    ...data.form,
    salesOrderNo: order?.sales_order_no,
    salesContractNo: order?.sales_contract_no,
    salesDate: order?.order_date,
    customerAccountName: data.form?.customerAccountName || order?.customer_name,
    currencyType: data.form?.currencyType || order?.currency_code,
    secondaryCurrency: data.form?.secondaryCurrency || order?.currency_code,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <Button size="sm" variant="outline" onClick={onBack}>{tr("Back")}</Button>
        <strong>{lot.goodsName} · <bdi>{lot.lotNo}</bdi></strong>
        <span>{tr("Remaining Balance")}: <bdi>{fmt(lot.remainingQty ?? lot.availableQty)} {lot.qtyName}</bdi></span>
      </div>
      <div className="grid flex-1 lg:grid-cols-[minmax(270px,1fr)_minmax(0,2.5fr)]">
        <section className="min-w-0 border-e p-3">
          <h4 className="mb-3 font-bold">{tr("Sales Booking")}</h4>
          {loading ? <p role="status">…</p> : failed ? <p role="alert">{tr("Failed to load")}</p> : !bills.size ? <p>{tr("No records found")}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead><tr className="bg-slate-100 dark:bg-slate-800">
                  {["Bill No", "Date", "Customer", "Sold Quantity"].map(label => <th scope="col" key={label} className="p-2 text-start">{tr(label)}</th>)}
                </tr></thead>
                <tbody>{[...bills.values()].map(bill => (
                  <tr key={bill.orderId} className={bill.orderId === billId ? "bg-blue-50 dark:bg-blue-950" : "border-b"}>
                    <td className="p-2"><button type="button" aria-pressed={bill.orderId === billId} className="font-bold underline" onClick={() => setSelected(bill.orderId)}>{bill.reference}</button></td>
                    <td className="p-2">{bill.date}</td><td className="p-2">{bill.customer}</td>
                    <td className="p-2"><bdi>{fmt(bill.quantity)} {lot.qtyName}</bdi></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
        <section className="min-w-0 p-3">
          {billId && !current && <p role="status">…</p>}
          {current?.error && <p role="alert">{tr("Failed to load")}</p>}
          {order && <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-bold">{tr("Bill No")}: <bdi>{selectedBill.reference}</bdi></h4>
              <Button size="sm" onClick={() => printDomFragmentViaModal(printId, selectedBill.reference, { lang, orientation: "landscape" })}>{tr("Print")}</Button>
            </div>
            <div id={printId} className="space-y-3">
              <p className="rounded bg-blue-50 p-2 text-sm text-blue-950">
                {tr("Lot Number")}: <bdi>{lot.lotNo}</bdi> · {tr("Sold Quantity")}: <strong><bdi>{fmt(selectedBill.quantity)} {lot.qtyName}</bdi></strong>
              </p>
              <SalesBookingContract form={form} goodsEntries={Array.isArray(data.goodsEntries) ? data.goodsEntries : []}
                lang={lang} showConversion highlightedLot={lot.lotNo} invoiceTotal={order.order_total} />
            </div>
          </div>}
        </section>
      </div>
    </div>
  );
}
