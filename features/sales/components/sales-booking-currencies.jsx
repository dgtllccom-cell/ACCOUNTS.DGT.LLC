"use client";

import React from "react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { convertedSalesAmount, getBookingCurrencies } from "@/lib/sales/booking-currencies";

const currencyOptions = ["AED", "USD", "EUR", "GBP", "PKR", "AFN", "INR", "CNY", "SAR"];
const field = "w-full min-w-0 h-8 rounded-md border border-slate-200 bg-white px-2 text-base text-slate-900 sm:text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const label = "block space-y-1 text-[10px] font-bold uppercase leading-tight text-slate-600 dark:text-slate-300";

function CurrencySelect({ title, value, onChange, disabled }) {
  return (
    <label className={label}>
      <span>{title}</span>
      <select className={field} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
        <option value="">—</option>
        {[...new Set([...currencyOptions, value].filter(Boolean))].map(code => <option key={code}>{code}</option>)}
      </select>
    </label>
  );
}

export function SalesBookingCurrencyFields({ form, lang, onChange, readOnly = false, goods = false }) {
  const tr = key => translateHeader(lang, key);
  const { purchase, sales, final, rate } = getBookingCurrencies(form);
  const displayRate = rate.ok ? (rate.operator === "/" ? "÷ " : "× ") + rate.rate : "—";

  return (
    <div className={`grid ${goods ? "grid-cols-2" : "grid-cols-1"} gap-2 rounded-lg border border-indigo-100 bg-indigo-50/70 p-2 dark:border-indigo-900 dark:bg-indigo-950/40`}>
      {goods && (
        <CurrencySelect title={tr("Purchase Currency")} value={form.goodsPurchaseCurrency || purchase}
          disabled={readOnly} onChange={value => onChange("goodsPurchaseCurrency", value)} />
      )}
      {goods ? (
        <label className={label}><span>{tr("Sales Currency")}</span><input className={field} value={sales} readOnly /></label>
      ) : (
        <CurrencySelect title={tr("Sales Currency")} value={sales} disabled={readOnly} onChange={value => onChange("salesCurrency", value)} />
      )}
      {goods ? (
        <label className={label}><span>{tr("Exchange Rate")}</span><input className={field} dir="ltr" value={displayRate} readOnly /></label>
      ) : (
        <div className="min-w-0">
          <label htmlFor="sales-booking-exchange-rate" className={label}>{tr("Exchange Rate")}</label>
          <div className="mt-1 flex gap-1" dir="ltr">
            <input id="sales-booking-exchange-rate" type="number" inputMode="decimal" min="0.00000001" step="any"
              className={`${field} flex-1`} value={rate.sameCurrency ? 1 : form.exchangeRate ?? ""} readOnly={readOnly || rate.sameCurrency}
              onChange={event => onChange("exchangeRate", event.target.value === "" ? "" : Number(event.target.value))} />
            <select aria-label={tr("Exchange Rate Type")} className={`${field} w-12 shrink-0 px-1`} value={rate.sameCurrency ? "*" : form.operator || "*"}
              disabled={readOnly || rate.sameCurrency} onChange={event => onChange("operator", event.target.value)}>
              <option value="*">×</option><option value="/">÷</option>
            </select>
          </div>
        </div>
      )}
      {goods ? (
        <label className={label}><span>{tr("Final Currency")}</span><input className={field} value={final} readOnly /></label>
      ) : (
        <CurrencySelect title={tr("Final Currency")} value={final} disabled={readOnly} onChange={value => onChange("secondaryCurrency", value)} />
      )}
    </div>
  );
}

export function SalesBookingCurrencyPreview({ form, lang, amount, goods = false, className = "" }) {
  const tr = key => translateHeader(lang, key);
  const { purchase, sales, rate, final } = getBookingCurrencies(form);
  const converted = amount == null ? null : convertedSalesAmount(amount, rate);
  const values = [
    ["Purchase Currency", goods ? form.goodsPurchaseCurrency || purchase : purchase],
    ["Sales Currency", sales],
    ["Exchange Rate", rate.ok ? `${rate.operator === "/" ? "÷" : "×"} ${rate.rate}` : "—"],
    ["Final Currency", final],
  ];
  if (converted != null) values.push(["Final Amount", `${final} ${converted.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]);
  return (
    <aside className={`sticky top-2 z-10 rounded-lg border border-indigo-100 bg-white p-2 shadow-sm dark:border-indigo-900 dark:bg-slate-900 ${className}`}>
      <h3 className="mb-1 text-xs font-bold text-indigo-800 dark:text-indigo-300">{tr("Currency Preview")}</h3>
      <dl aria-live="polite" className="grid grid-cols-2 gap-x-2 gap-y-1 lg:grid-cols-1">
        {values.map(([key, value]) => (
          <div key={key} className="flex min-w-0 flex-wrap items-center justify-between gap-x-1 text-[10px]">
            <dt>{tr(key)}</dt><dd className="font-bold"><bdi>{value || "—"}</bdi></dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
