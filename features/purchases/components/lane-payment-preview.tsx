"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { DueBill } from "@/features/journal/components/remaining-due-bills";
import { finalCurrencyAmount } from "@/lib/purchases/final-currency";

type PreviewBill = DueBill & { paymentKnown?: boolean; purchaseAccount?: string; purchaseAccountNo?: string; salesAccount?: string; salesAccountNo?: string; totalContainers?: number; loadedContainers?: number; remainingContainers?: number };
type Load = { id: string; source_id?: string; source_type?: string; purchase_ref_no?: string };
const nf = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Read-only review of the original bill. Reuses Remaining's calculation, never posts a payment. */
export function LanePaymentPreview({ loads, lang, onReady }: { loads: Load[]; lang: string; onReady: (ready: boolean) => void }) {
  const s = useErpScreen("rdue", lang);
  const [bills, setBills] = useState<PreviewBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const loadKey = JSON.stringify(loads);
  useEffect(() => {
    let active = true;
    setLoading(true); setFailed(false); onReady(false);
    const selected = JSON.parse(loadKey) as Load[];
    const urls = [...new Set(selected.map(l => l.source_type === "purchase_booking"
      ? `/api/erp/purchases/remaining-due?orderNo=${encodeURIComponent(l.purchase_ref_no || "")}&includeSettled=1&lang=${lang}`
      : `/api/erp/purchases/lane/${encodeURIComponent(l.id)}/payment-preview?lang=${lang}`))];
    Promise.all(urls.map(url => apiGet<{ bills: PreviewBill[] }>(url)))
      .then(results => { if (active) setBills([...new Map(results.flatMap(r => r.bills).map(b => [b.id,b])).values()]); })
      .catch(() => { if (active) { setBills([]); setFailed(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadKey, lang, retry, onReady]);
  const ready = !loading && !failed && loads.every(l => {
    const b = bills.find(b => b.billNo === l.purchase_ref_no);
    return !!b && b.loadings.some(x => x.id === l.source_id) && finalCurrencyAmount(b.billTotal, b.currency, b.localCurrency, b.exchangeRate) != null;
  });
  const financialReady = ready && bills.every(b => b.paymentKnown !== false);
  useEffect(() => { onReady(financialReady); }, [financialReady, onReady]);
  if (loading) return <p role="status">{s.tGlobal("report.builder_loading", "Loading data...")}</p>;
  if (failed || !ready) return <div role="alert" className="rounded-xl border border-amber-300 p-4"><p>{s.tGlobal("plane.preview_unavailable", "The complete payment review is unavailable. Remaining transfer requires a verified bill, loading, country currency and exchange rate.")}</p><button type="button" className="mt-3 rounded border px-3 py-2" onClick={() => setRetry(n => n + 1)}>{s.tGlobal("go.go_retry_loading", "Retry Loading")}</button></div>;
  const moneyTable = (b: PreviewBill, rows: [string, number | null][]) => <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-100 dark:bg-slate-800"><tr><th className="p-2 text-start">{s.tGlobal("plane.preview_detail", "Details")}</th><th className="p-2">{b.currency}</th><th className="p-2 font-black">{b.localCurrency}</th></tr></thead><tbody>{rows.map(([label, value]) => <tr key={label} className="border-b border-slate-200 dark:border-slate-700"><th className="p-2 text-start font-medium">{label}</th><td className="p-2 text-end tabular-nums" dir="ltr">{value == null ? "—" : nf(value)}</td><td className="p-2 text-end font-bold tabular-nums" dir="ltr">{value == null ? "—" : nf(finalCurrencyAmount(value, b.currency, b.localCurrency, b.exchangeRate)!)}</td></tr>)}</tbody></table></div>;
  return <div className="space-y-6" dir={s.dir}>{bills.map(b => {
    const selected = b.loadings.filter(x => loads.some(l => l.source_id === x.id));
    return <article key={b.id} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      <h3 className="mb-3 font-mono font-black" dir="ltr">{b.billNo}</h3>
      {b.paymentKnown === false && <p role="status" className="mb-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{s.tGlobal("plane.payment_unverified", "Paid amounts cannot be verified from cash/bank postings. The entered advance is not treated as a payment.")}</p>}
      {!!b.totalContainers && <section className="mb-3 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800"><h4 className="mb-2 font-bold">{s.tGlobal("log.seg_containers", "Containers")}</h4><div className="grid grid-cols-3 gap-2">{[[s.t("col_total_qty", "Total qty"),b.totalContainers],[s.t("col_loaded_qty", "Loaded"),b.loadedContainers],[s.t("col_balance_qty", "Balance qty"),b.remainingContainers]].map(([label,v]) => <div key={String(label)}><span>{label}</span><strong className="block tabular-nums">{v ?? "—"}</strong></div>)}</div></section>}
      <div className="overflow-x-auto"><table className="mb-4 w-full text-xs"><thead className="bg-amber-50 dark:bg-slate-800"><tr>{[s.t("col_total_qty", "Total qty"), s.t("col_loaded_qty", "Loaded"), s.t("col_balance_qty", "Balance qty")].map(t => <th key={t} className="p-2">{t}</th>)}</tr></thead><tbody><tr>{[b.totalQuantity,b.loadedQuantity,b.balanceQuantity].map((v,i) => <td key={i} className="p-2 text-center tabular-nums">{v.toLocaleString()}</td>)}</tr></tbody></table></div>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">{[
        [s.tGlobal("plane.preview_branch", "Branch Details"), b.branch, b.country],
        [s.tGlobal("purchase.card_purchase_account_details", "Purchase Account Details"), b.purchaseAccount, b.purchaseAccountNo],
        [s.tGlobal("purchase.sales_account_short_title", "Sales Account"), b.salesAccount, b.salesAccountNo]
      ].map(([title,name,code]) => <section key={title} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><h4 className="mb-1 text-[10px] font-bold text-slate-500">{title}</h4><p dir="auto" className="text-xs font-semibold">{name || "—"}</p><p dir="auto" className="text-[10px]">{code || "—"}</p></section>)}</div>
      <p className="mb-2 text-xs" dir="auto">{b.goods}</p>
      <p className="mb-3 text-xs" dir="ltr">{b.currency} × {b.exchangeRate} = {b.localCurrency}</p>
      {moneyTable(b, [[s.t("col_bill_total", "Bill total"),b.billTotal],[s.t("col_advance", "Advance paid / required"),b.advancePaid],[s.t("col_total_paid", "Total paid"),b.totalPaid],[s.t("col_outstanding", "Outstanding"),b.outstanding]])}
      {selected.map(l => <section key={l.id} className="mt-5"><h4 className="mb-2 text-xs font-bold" dir="auto">{l.loadingNo} · {l.container} · {l.quantity.toLocaleString()}</h4><dl className="mb-3 grid grid-cols-2 gap-2 rounded bg-slate-50 p-2 text-xs dark:bg-slate-800"><div><dt>{s.tGlobal("tl.gross_weight_kg", "Gross Weight (KG)")}</dt><dd className="font-bold tabular-nums">{l.grossWeightKg == null ? "—" : nf(l.grossWeightKg)}</dd></div><div><dt>{s.t("col_net_kg", "Net weight (kg)")}</dt><dd className="font-bold tabular-nums">{nf(l.netWeightKg)}</dd></div></dl>{moneyTable(b, [[s.t("col_value", "Loaded goods value"),l.value],[s.t("col_adv_alloc", "Advance allocated"),l.advanceAllocated],[s.t("col_paid_loading", "Paid"),l.paid],[s.t("col_payable", "Payable now"),l.outstanding]])}</section>)}
    </article>;
  })}</div>;
}
