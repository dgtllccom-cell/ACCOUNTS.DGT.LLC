"use client";

import React from "react";

import { translateHeader } from "@/lib/i18n/table-headers";
import { remainingBookingRow, uniqueBookingRows } from "@/lib/journal/remaining-booking-table";

export function RemainingBookingTable({ rows, loadingRecords, lang, onSelectOrder }: {
  rows: any[]; loadingRecords: any[]; lang: string; onSelectOrder: (id: string) => void;
}) {
  const label = (value: string) => translateHeader(lang, value);
  const format = (value: number | null, decimals = 2) => value == null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: decimals });
  const date = (value: string) => value ? value.split("T")[0] : "—";
  const headers = ["Bill No", "Date", "Country / Branch", "Supplier", "Goods Name", "Total Quantity", "Unit", "Gross Weight", "Net Weight", "Loading Country", "Loading Port", "Loading Date", "Receiving Country", "Receiving Port", "Received Date", "Currency", "Exchange Rate", "Bill Total", "Paid", "Balance", "Journal"];
  const routeKeys = ["loadingCountry", "loadingPort", "loadingDate", "receivingCountry", "receivingPort", "receivedDate"] as const;
  const cell = "border-e border-slate-200 px-2 py-2 align-top dark:border-slate-800";
  const numeric = `${cell} text-end font-mono tabular-nums whitespace-nowrap`;
  return (
    <table dir={["ur", "ar", "fa", "ps"].includes(lang) ? "rtl" : "ltr"} className="w-full min-w-[1900px] border-collapse text-start text-xs" data-testid="remaining-booking-table">
      <thead><tr className="border-b border-amber-300 bg-[#ffd257] text-[11px] font-black text-slate-900">
        {headers.map(header => <th key={header} scope="col" className="whitespace-nowrap border-e border-amber-300 px-2 py-3 text-start">{label(header)}{header === "Gross Weight" || header === "Net Weight" ? " (kg)" : ""}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {uniqueBookingRows(rows).map(row => {
          const bill = remainingBookingRow(row, loadingRecords);
          return <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <td className={`${cell} font-mono font-bold text-blue-700 dark:text-blue-400`}><button type="button" onClick={() => onSelectOrder(bill.id)} className="min-h-11 text-start underline-offset-4 hover:underline focus-visible:underline">{bill.billNo || "—"}</button></td>
            <td className={cell}>{date(bill.date)}</td>
            <td className={`${cell} font-mono`}>{bill.countryBranch || "—"}</td>
            <td className={cell}>{bill.supplier || "—"}</td>
            <td className={`${cell} min-w-32 font-semibold`}>{bill.goods || "—"}</td>
            <td className={numeric}>{format(bill.quantity, 3)}</td>
            <td className={cell}>{bill.unit || "—"}</td>
            <td className={numeric}>{format(bill.grossKg, 3)}</td>
            <td className={numeric}>{format(bill.netKg, 3)}</td>
            {routeKeys.map(key => <td key={key} className={`${cell} min-w-24`}>
              {bill.routes.map(route => <div key={route.id} className="min-h-6 whitespace-pre-wrap break-words" dir="auto">{key === "loadingDate" || key === "receivedDate" ? date(route[key]) : route[key] || "—"}</div>)}
            </td>)}
            <td className={`${cell} font-bold`}>{bill.currency}</td>
            <td className={numeric}>{format(bill.exchangeRate, 4)}</td>
            <td className={numeric}>{format(bill.total)}</td>
            <td className={`${numeric} text-emerald-700 dark:text-emerald-400`}>{format(bill.paid)}</td>
            <td className={`${numeric} font-bold text-rose-700 dark:text-rose-400`}>{format(bill.balance)}</td>
            <td className={cell}><button type="button" onClick={() => onSelectOrder(bill.id)} className="min-h-11 rounded-lg bg-blue-600 px-3 font-bold text-white hover:bg-blue-700">{label("Journal")}</button></td>
          </tr>;
        })}
      </tbody>
    </table>
  );
}
