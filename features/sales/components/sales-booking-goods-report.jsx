"use client";

import React from "react";
import { BarChart3, Building2, Edit3, Package, Trash2, Truck, UserRound } from "lucide-react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { getBookingCurrencies } from "@/lib/sales/booking-currencies";

export function SalesBookingGoodsReport({ form, goodsEntries, lang, onEdit, onDelete, overviewCards, showOrigin = false }) {
  const currencies = getBookingCurrencies(form);
  const tr = label => translateHeader(lang, label);
  const number = (value, digits = 3) => value == null || value === "" || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toLocaleString(lang, { maximumFractionDigits: digits });
  const amount = (value, currency) => value == null || value === ""
    ? "—"
    : [currency, Number(value).toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })].filter(Boolean).join(" ");
  const rateText = (rate, operator) => Number(rate) > 0 ? `${operator === "/" ? "÷" : "×"} ${rate}` : "—";
  const volume = item => {
    const value = item.cbm ?? item.volumeCbm ?? String(item.stackWeight ?? "").match(/(\d+(?:\.\d+)?)\s*(?:cbm\b|m³)/i)?.[1];
    return value == null || value === "" ? null : Number(value);
  };
  const total = key => goodsEntries.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
  const quantityByUnit = new Map();
  const salesByCurrency = new Map();
  const finalByCurrency = new Map();
  for (const item of goodsEntries) {
    const unit = item.qtyName || item.unit || "";
    quantityByUnit.set(unit, (quantityByUnit.get(unit) || 0) + Number(item.qtyNo ?? item.quantity ?? 0));
    if (item.totalAmount != null) {
      const currency = item.salesCurrency || item.currencyType || currencies.sales;
      salesByCurrency.set(currency, (salesByCurrency.get(currency) || 0) + Number(item.totalAmount));
    }
    if (item.finalAmount != null) {
      const currency = item.secondaryCurrency || currencies.final;
      finalByCurrency.set(currency, (finalByCurrency.get(currency) || 0) + Number(item.finalAmount));
    }
  }
  const summarizeAmounts = values => Array.from(values, ([currency, value]) => amount(value, currency)).join(" · ");
  const volumes = goodsEntries.map(volume).filter(Number.isFinite);
  const cards = overviewCards ?? [
    { title: "Booking / Branch Details", Icon: Building2, color: "bg-blue-50 text-blue-950 dark:bg-blue-950 dark:text-blue-100",
      rows: [["Booking No", form.salesOrderNo], ["Booking Date", form.salesDate], ["Branch", form.branchName || form.branchCode], ["Country", form.branchCountry]] },
    { title: "Loading Details", Icon: Truck, color: "bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
      rows: [["Loading Type", form.shippingMode || form.shipmentType], ["Loading Port", form.salesPortOfLoading || form.loadingPort],
        ["Destination", form.receivingPort || form.salesPortOfDischarge || form.receivingCountry], ["Loading Date", form.loadingDate]] },
    { title: "Sales Account", Icon: UserRound, color: "bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100",
      rows: [["Customer Account (DR)", form.customerAccountName || form.customerAccountNo], ["Sales Account (CR)", form.salesAccountName || form.salesAccountNo],
        ["Sales Currency", currencies.sales], ["Exchange Rate", rateText(currencies.rate.rate, currencies.rate.operator)]] },
    { title: "Summary Totals", Icon: BarChart3, color: "bg-violet-50 text-violet-950 dark:bg-violet-950 dark:text-violet-100",
      rows: [["Total Qty", Array.from(quantityByUnit, ([unit, value]) => `${number(value)} ${unit}`.trim()).join(" · ")],
        ["Net Weight", `${number(total("netWeight"))} kg`], ["Gross Weight", `${number(total("grossWeight"))} kg`],
        ["CBM", volumes.length === goodsEntries.length && volumes.length > 0 ? number(volumes.reduce((sum, value) => sum + value, 0)) : "—"],
        ["Sales Amount", summarizeAmounts(salesByCurrency)], ["Final Amount", summarizeAmounts(finalByCurrency)]] },
  ];

  const hasActions = Boolean(onEdit || onDelete);

  return (
  <div className="min-w-0 space-y-3">
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, Icon, color, rows }) => (
        <section key={title} className={`min-w-0 rounded-xl p-3 ${color}`}>
          <h3 className="mb-2 flex gap-1.5 text-xs font-bold">
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{tr(title)}
          </h3>
          <dl className="space-y-1.5 text-[11px]">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-2">
                <dt className="min-w-0 break-words">{tr(label)}</dt>
                <dd className="min-w-0 break-words text-end font-semibold"><bdi>{value || "—"}</bdi></dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>

    <section className="min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="flex items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-2 text-sm font-bold text-blue-950 dark:bg-blue-950 dark:text-blue-100">
        <Package className="h-4 w-4 shrink-0" aria-hidden="true" />
        {tr("Goods and Lotwise Report")}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-start text-xs">
          <thead className="bg-blue-50 text-blue-950 dark:bg-blue-950 dark:text-blue-100">
            <tr className="text-start">
              <th scope="col" className="px-2 py-2">#</th>
              {["Goods Name", "HS Code", "Lot / Item ID", ...(showOrigin ? ["Origin"] : []), "Quantity", "Net Weight", "Gross Weight", "CBM",
                "Unit Price", "Sales Amount", "Exchange Rate", "Final Amount", ...(hasActions ? ["Action"] : [])].map(label => (
                <th key={label} scope="col" className="whitespace-nowrap px-2 py-2 text-start">{tr(label)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {goodsEntries.map((item, index) => (
              <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                <td className="px-2 py-2 text-center">{index + 1}</td>
                <td className="px-2 py-2 font-semibold">{item.goodsName || item.productName}</td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{item.hsCode || "—"}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{item.lotNo || item.itemId || "—"}</bdi></td>
                {showOrigin && <td className="whitespace-nowrap px-2 py-2">{item.origin || "—"}</td>}
                <td className="whitespace-nowrap px-2 py-2"><bdi>{number(item.qtyNo ?? item.quantity)} {item.qtyName || item.unit}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{number(item.netWeight)}{item.netWeight == null ? "" : " kg"}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{number(item.grossWeight)}{item.grossWeight == null ? "" : " kg"}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{number(volume(item))}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{amount(item.coursePrice ?? item.unitPrice, item.salesCurrency || item.currencyType || currencies.sales)}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{amount(item.totalAmount, item.salesCurrency || item.currencyType || currencies.sales)}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2"><bdi>{rateText(item.exchangeRate, item.op || item.operator)}</bdi></td>
                <td className="whitespace-nowrap px-2 py-2 font-semibold"><bdi>{amount(item.finalAmount, item.secondaryCurrency || currencies.final)}</bdi></td>
                {hasActions && <td className="px-2 py-2">
                  <div className="flex gap-1">
                    {onEdit && <button type="button" onClick={() => onEdit(index)}
                      className="rounded bg-sky-50 p-1 text-sky-700 hover:bg-sky-100" aria-label={tr("Edit")}>
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>}
                    {onDelete && <button type="button" onClick={() => onDelete(index)}
                      className="rounded bg-red-50 p-1 text-red-600 hover:bg-red-100" aria-label={tr("Delete")}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>}
                  </div>
                </td>}
              </tr>
            ))}
            {goodsEntries.length === 0 && (
              <tr>
                <td colSpan={12 + Number(showOrigin) + Number(hasActions)} className="p-6 text-center text-slate-500">{tr("No goods entered")}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  </div>
  );
}
