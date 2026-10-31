"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { t as tUi } from "@/lib/i18n/ui";
import { resolveBookingRate, suggestDailyRate, type DailyRateInfo } from "@/lib/sales/sales-goods-model";

export const SALES_CURRENCIES = ["USD", "AED", "EUR", "GBP", "PKR", "AFN", "INR", "CNY", "SAR"];

type Props = {
  form: Record<string, any>;
  setForm: (updater: (prev: Record<string, any>) => Record<string, any>) => void;
  lang?: string;
  /** the booking branch's own currency (from its country) — the Daily Exchange Rate is USD ↔ this currency */
  localCurrency?: string;
};

type DailyState = { status: "idle" | "loading" | "ok" | "none" | "denied"; info: DailyRateInfo | null };

/**
 * Sales Booking — "Booking Currency & Conversion" (Step 1). Same card as the Purchase Booking, plus:
 *  - the Daily Exchange Rate of the booking's country / branch is read through the existing /api/erp/currency/latest-rate endpoint (which
 *    enforces the session and its country / branch scope), shown with its date, and applied only when the user clicks it (or when the
 *    pair is USD ↔ the branch currency and the rate field is still empty);
 *  - a rate is never invented: with two different currencies an empty / zero rate is flagged and Step 1 will not continue.
 */
export function SalesCurrencyConversionCard({ form, setForm, lang = "en", localCurrency = "" }: Props) {
  const tt = (k: string, fb: string) => tUi(lang, `sales.bk_${k}`, fb);
  const invoice = String(form.currencyType || "").toUpperCase();
  const settlement = String(form.secondaryCurrency || "").toUpperCase();
  const resolved = resolveBookingRate({ invoiceCurrency: invoice, settlementCurrency: settlement, exchangeRate: form.exchangeRate, operator: form.operator });
  const [daily, setDaily] = useState<DailyState>({ status: "idle", info: null });

  const countryId = String(form.countryId || "");
  const countryBranchId = String(form.countryBranchId || "");
  useEffect(() => {
    if (!countryId) {
      setDaily({ status: "idle", info: null });
      return;
    }
    let cancelled = false;
    setDaily({ status: "loading", info: null });
    const qs = new URLSearchParams({ countryId });
    if (countryBranchId) qs.set("countryBranchId", countryBranchId);
    fetch(`/api/erp/currency/latest-rate?${qs.toString()}`, { credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) return { status: "denied" as const, info: null };
        const j = await res.json().catch(() => null);
        if (!res.ok || !j) return { status: "none" as const, info: null };
        return j.source === "daily_usd_rates" ? { status: "ok" as const, info: j as DailyRateInfo } : { status: "none" as const, info: null };
      })
      .catch(() => ({ status: "none" as const, info: null }))
      .then((s) => !cancelled && setDaily(s));
    return () => {
      cancelled = true;
    };
  }, [countryId, countryBranchId]);

  const suggestion = useMemo(() => suggestDailyRate(daily.info, invoice, settlement, localCurrency), [daily.info, invoice, settlement, localCurrency]);

  const apply = (rate: number, operator: "*" | "/" = "*") =>
    setForm((p) => ({ ...p, exchangeRate: rate, operator, exchangeRateSource: "daily", manualFinalAmount: "", manualTotalAmount: "" }));

  // pre-fill ONCE from the daily rate when the pair is USD ↔ branch currency and nothing has been entered yet
  useEffect(() => {
    if (suggestion && !(Number(form.exchangeRate) > 0)) apply(suggestion.rate, suggestion.operator);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion?.rate, suggestion?.operator]);

  const setCurrency = (key: "currencyType" | "secondaryCurrency", value: string) =>
    setForm((p) => {
      const next: Record<string, any> = { ...p, [key]: value, manualFinalAmount: "", manualTotalAmount: "" };
      if (key === "currencyType") next.salesCurrency = value;
      if (key === "secondaryCurrency") next.paymentCurrency = value;
      // a different pair needs its own rate: drop a rate that belonged to the previous pair
      next.exchangeRate = "";
      next.exchangeRateSource = "";
      return next;
    });

  const ctl = "h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const missingRate = !resolved.ok && resolved.reason === "missing_rate";
  const chip = (label: string, value?: number | null) =>
    value && value > 0 ? (
      <button
        key={label}
        type="button"
        onClick={() => apply(value, suggestion?.operator ?? "*")}
        className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
        data-testid={`daily-rate-${label.toLowerCase()}`}
      >
        {label} {value}
      </button>
    ) : null;

  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50" data-testid="booking-currency-card">
      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
        <ArrowRightLeft className="h-3.5 w-3.5 text-blue-600" />
        <span className="text-[11px] font-black uppercase tracking-wider">{tt("currency_title", "Booking Currency & Conversion")}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{tt("invoice_currency", "Invoice Currency")}</label>
          <select value={invoice} onChange={(e) => setCurrency("currencyType", e.target.value)} className={ctl} data-testid="invoice-currency">
            <option value="">{tt("select_currency", "Select currency")}</option>
            {SALES_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">{tt("settlement_currency", "Settlement Currency")}</label>
          <select value={settlement} onChange={(e) => setCurrency("secondaryCurrency", e.target.value)} className={ctl} data-testid="settlement-currency">
            <option value="">{tt("select_currency", "Select currency")}</option>
            {SALES_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
          {tt("exchange_rate", "Exchange Rate")} ({invoice || "—"} → {settlement || "—"})
        </label>
        {invoice && settlement && invoice === settlement ? (
          <p className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" data-testid="rate-same-currency">
            {tt("same_currency", "Same currency — no conversion needed (rate 1).")}
          </p>
        ) : (
          <>
            <div className="flex gap-1">
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={form.exchangeRate ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, exchangeRate: e.target.value === "" ? "" : Number(e.target.value), exchangeRateSource: "manual", manualFinalAmount: "", manualTotalAmount: "" }))}
                placeholder="0.0000"
                aria-invalid={missingRate}
                className={`${ctl} font-mono ${missingRate && invoice && settlement ? "border-red-400" : ""}`}
                data-testid="exchange-rate"
              />
              <select
                value={form.operator || "*"}
                onChange={(e) => setForm((p) => ({ ...p, operator: e.target.value, manualFinalAmount: "", manualTotalAmount: "" }))}
                className="h-8 w-12 rounded-lg border border-slate-200 bg-white text-center text-xs font-black outline-none dark:border-slate-700 dark:bg-slate-900"
                aria-label="operator"
              >
                <option value="*">*</option>
                <option value="/">/</option>
              </select>
            </div>
            {missingRate && invoice && settlement && (
              <p className="mt-1 text-[11px] font-bold text-red-600" data-testid="rate-required">{tt("rate_required", "Enter the exchange rate — a conversion cannot use a zero or missing rate.")}</p>
            )}
          </>
        )}
      </div>

      {/* Daily Exchange Rate of this branch */}
      <div className="rounded-lg border border-dashed border-slate-300 p-2 text-[10px] dark:border-slate-700" data-testid="daily-rate-box">
        <div className="mb-1 font-black uppercase tracking-wide text-slate-500">{tt("daily_rate", "Daily Exchange Rate")}</div>
        {daily.status === "loading" && <span className="text-slate-400">{tt("checking", "Checking today's rate…")}</span>}
        {daily.status === "idle" && <span className="text-slate-400">{tt("pick_country", "Select the country and branch to see the daily rate.")}</span>}
        {daily.status === "denied" && <span className="text-amber-700">{tt("daily_denied", "Daily rates are not available to your role — enter the rate manually.")}</span>}
        {daily.status === "none" && <span className="text-amber-700">{tt("daily_none", "No Daily Exchange Rate is recorded for this branch — enter the rate manually.")}</span>}
        {daily.status === "ok" && daily.info && (
          <div className="flex flex-wrap items-center gap-1.5">
            {suggestion && chip(tt("rate_buy", "Buy"), daily.info.buyRate)}
            {suggestion && chip(tt("rate_sell", "Sell"), daily.info.sellRate)}
            {suggestion && chip(tt("rate_credit", "Credit"), daily.info.creditRate)}
            {suggestion && chip(tt("rate_debit", "Debit"), daily.info.debitRate)}
            {daily.info.effectiveDate && <span className="text-slate-500">{tt("as_of", "as of")} {String(daily.info.effectiveDate).slice(0, 10)}</span>}
            {!suggestion && invoice && settlement && invoice !== settlement && <span className="basis-full text-slate-500">{tt("usd_only", "The daily rate is a USD rate: it is applied automatically only for USD ↔ the branch currency.")}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
