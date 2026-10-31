"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

/**
 * "Bills waiting for Remaining Payment" - the loaded bills that can be paid now. It lists the ORIGINAL bill (not a copy), its quantities (total /
 * loaded / balance), its money (bill total, advance paid / required, total paid, outstanding) and, per loading (truck / container), what that
 * loading is worth, the advance allocated to it, what was paid against it and what is payable now. The figures come from
 * /api/erp/purchases/remaining-due, which uses the same rules the payment API enforces. Paying opens the existing payment document for the bill.
 */

export type DueLoading = {
  id: string; loadingNo: string | null; container: string | null; quantity: number; netWeightKg: number;
  value: number; advanceAllocated: number; paid: number; outstanding: number; complete: boolean;
};
export type DueBill = {
  id: string; billNo: string; manualBillNo: string | null; supplier: string | null; goods: string; country: string | null; branch: string | null;
  currency: string; localCurrency: string; exchangeRate: number; condition: string;
  billTotal: number; advancePercent: number; advanceRequired: number; advancePaid: number; remainingPaid: number; totalPaid: number; outstanding: number;
  totalQuantity: number; loadedQuantity: number; balanceQuantity: number; payableNow: number; loadings: DueLoading[];
};

const nf = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const qf = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 3 }) : "—");

export function RemainingDueBills({
  lang,
  search,
  countryFilter,
  branchFilter,
  onPay
}: {
  lang: string;
  search: string;
  countryFilter?: string;
  branchFilter?: string;
  onPay: (orderId: string, loadingId?: string) => void;
}) {
  const s = useErpScreen("rdue", lang as never);
  const [bills, setBills] = useState<DueBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/erp/purchases/remaining-due", { credentials: "include", cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body?.ok) throw new Error("load");
      setBills(Array.isArray(body.data?.bills) ? body.data.bills : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("refresh-payments", refresh);
    return () => window.removeEventListener("refresh-payments", refresh);
  }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills.filter((b) => {
      if (countryFilter && (b.country || "") !== countryFilter) return false;
      if (branchFilter && (b.branch || "") !== branchFilter) return false;
      if (!q) return true;
      return [b.billNo, b.manualBillNo, b.supplier, b.goods].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [bills, search, countryFilter, branchFilter]);

  const th = "px-2.5 py-2 text-start text-[11px] font-black uppercase tracking-wide text-slate-500";
  const td = "px-2.5 py-2 align-top text-xs text-slate-800 dark:text-slate-200";

  return (
    <section dir={s.dir} className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" data-testid="rdue-section">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3.5 py-2.5 dark:border-slate-800">
        <div className="min-w-0">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-300">
            {s.t("title", "Bills waiting for Remaining Payment")} ({shown.length})
          </h3>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            {s.t("subtitle", "Loaded bills only. A bill shows what is payable for the goods loaded so far (their value minus the advance allocated to them); goods not loaded yet are not payable.")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          title={s.t("refresh", "Refresh")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {error ? (
        <div className="m-3 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300" data-testid="rdue-error">
          {s.t("load_error", "Could not load the bills waiting for payment.")}
        </div>
      ) : loading && bills.length === 0 ? (
        <div className="p-4 text-xs font-semibold text-slate-500">{s.t("loading_list", "Loading bills…")}</div>
      ) : shown.length === 0 ? (
        <div className="p-4 text-xs font-semibold text-slate-500" data-testid="rdue-empty">{s.t("empty", "No loaded bill is waiting for a Remaining Payment.")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table data-no-cards className="w-full min-w-[1100px] border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/40">
              <tr>
                <th className={th} />
                <th className={th}>{s.t("col_bill", "Bill No.")}</th>
                <th className={th}>{s.t("col_supplier", "Supplier")}</th>
                <th className={th}>{s.t("col_goods", "Goods")}</th>
                <th className={cn(th, "text-end")}>{s.t("col_total_qty", "Total qty")}</th>
                <th className={cn(th, "text-end")}>{s.t("col_loaded_qty", "Loaded")}</th>
                <th className={cn(th, "text-end")}>{s.t("col_balance_qty", "Balance qty")}</th>
                <th className={cn(th, "text-end")}>{s.t("col_bill_total", "Bill total")}</th>
                <th className={cn(th, "text-end")}>{s.t("col_advance", "Advance paid / required")}</th>
                <th className={cn(th, "text-end")}>{s.t("col_total_paid", "Total paid")}</th>
                <th className={cn(th, "text-end")}>{s.t("col_outstanding", "Outstanding")}</th>
                <th className={cn(th, "text-end")}>{s.t("col_payable", "Payable now")}</th>
                <th className={th}>{s.t("col_action", "Action")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => {
                const isOpen = open.has(b.id);
                const toggle = () => setOpen((cur) => { const n = new Set(cur); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; });
                const local = b.currency !== b.localCurrency ? b.payableNow * b.exchangeRate : null;
                return (
                  <Fragment key={b.id}>
                    <tr className="border-t border-slate-200 odd:bg-white even:bg-slate-50/60 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-900/60" data-testid={`rdue-row-${b.billNo}`}>
                      <td className={td}>
                        <button type="button" onClick={toggle} aria-expanded={isOpen} aria-label={s.t("show_loadings", "Loadings")} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" data-testid={`rdue-toggle-${b.billNo}`}>
                          {isOpen ? <ChevronDown className="h-4 w-4 rtl:rotate-0" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
                        </button>
                      </td>
                      <td className={cn(td, "font-black text-blue-700 dark:text-blue-300")} dir="ltr">
                        {b.billNo}
                        {b.manualBillNo && b.manualBillNo !== b.billNo ? <div className="text-[10px] font-semibold text-slate-500">{b.manualBillNo}</div> : null}
                      </td>
                      <td className={cn(td, "max-w-[160px]")}>{b.supplier || "—"}</td>
                      <td className={cn(td, "max-w-[170px]")}>{b.goods || "—"}</td>
                      <td className={cn(td, "text-end tabular-nums")} dir="ltr">{qf(b.totalQuantity)}</td>
                      <td className={cn(td, "text-end tabular-nums font-bold")} dir="ltr" data-testid={`rdue-loaded-${b.billNo}`}>{qf(b.loadedQuantity)}</td>
                      <td className={cn(td, "text-end tabular-nums")} dir="ltr">{qf(b.balanceQuantity)}</td>
                      <td className={cn(td, "text-end tabular-nums")} dir="ltr">{nf(b.billTotal)} {b.currency}</td>
                      <td className={cn(td, "text-end tabular-nums")} dir="ltr">{nf(b.advancePaid)} {s.t("of", "of")} {nf(b.advanceRequired)} {b.currency}</td>
                      <td className={cn(td, "text-end tabular-nums")} dir="ltr">{nf(b.totalPaid)} {b.currency}</td>
                      <td className={cn(td, "text-end tabular-nums")} dir="ltr">{nf(b.outstanding)} {b.currency}</td>
                      <td className={cn(td, "text-end tabular-nums font-black text-emerald-700 dark:text-emerald-400")} dir="ltr" data-testid={`rdue-payable-${b.billNo}`}>
                        {nf(b.payableNow)} {b.currency}
                        {local != null ? <div className="text-[10px] font-semibold text-slate-500">≈ {nf(local)} {b.localCurrency}</div> : null}
                      </td>
                      <td className={td}>
                        <button type="button" onClick={() => onPay(b.id)} data-testid={`rdue-pay-${b.billNo}`} className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-[11px] font-black text-white hover:bg-blue-700">
                          {s.t("pay", "Pay Remaining")}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50/70 dark:bg-slate-950/30">
                        <td />
                        <td colSpan={12} className="px-2.5 pb-3">
                          <table data-no-cards className="w-full min-w-[820px] border-collapse text-[11px]">
                            <thead>
                              <tr>
                                <th className={th}>{s.t("col_loading_no", "Loading No.")}</th>
                                <th className={th}>{s.t("col_container", "Container / Truck")}</th>
                                <th className={cn(th, "text-end")}>{s.t("col_loaded_qty", "Loaded")}</th>
                                <th className={cn(th, "text-end")}>{s.t("col_net_kg", "Net weight (kg)")}</th>
                                <th className={cn(th, "text-end")}>{s.t("col_value", "Loaded goods value")}</th>
                                <th className={cn(th, "text-end")}>{s.t("col_adv_alloc", "Advance allocated")}</th>
                                <th className={cn(th, "text-end")}>{s.t("col_paid_loading", "Paid")}</th>
                                <th className={cn(th, "text-end")}>{s.t("col_payable", "Payable now")}</th>
                                <th className={th} />
                              </tr>
                            </thead>
                            <tbody>
                              {b.loadings.map((l) => (
                                <tr key={l.id} className="border-t border-slate-200 dark:border-slate-800" data-testid={`rdue-loading-${l.id}`}>
                                  <td className={td} dir="ltr">{l.loadingNo || "—"}</td>
                                  <td className={td} dir="ltr">{l.container || "—"}</td>
                                  <td className={cn(td, "text-end tabular-nums")} dir="ltr">{qf(l.quantity)}</td>
                                  <td className={cn(td, "text-end tabular-nums")} dir="ltr">{qf(l.netWeightKg)}</td>
                                  <td className={cn(td, "text-end tabular-nums")} dir="ltr">{nf(l.value)} {b.currency}</td>
                                  <td className={cn(td, "text-end tabular-nums")} dir="ltr">{nf(l.advanceAllocated)} {b.currency}</td>
                                  <td className={cn(td, "text-end tabular-nums")} dir="ltr">{nf(l.paid)} {b.currency}</td>
                                  <td className={cn(td, "text-end tabular-nums font-black", l.complete ? "text-slate-500" : "text-emerald-700 dark:text-emerald-400")} dir="ltr">
                                    {l.complete ? s.t("status_paid", "Paid in full") : `${nf(l.outstanding)} ${b.currency}`}
                                  </td>
                                  <td className={td}>
                                    {!l.complete && (
                                      <button type="button" onClick={() => onPay(b.id, l.id)} data-testid={`rdue-pay-loading-${l.id}`} className="inline-flex h-7 items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-black text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                                        {s.t("pay_loading", "Pay this loading")}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
