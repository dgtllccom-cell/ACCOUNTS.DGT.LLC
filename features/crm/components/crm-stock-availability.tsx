"use client";

/**
 * Read-only stock availability lookup for CRM / Sales users. Reuses the real,
 * already-scoped /api/erp/inventory/balances endpoint (GET only — no Stock
 * In/Out affordances rendered here at all, so there is no UI path for a
 * CRM/Sales user to alter inventory, only to see it).
 */
import { useCallback, useEffect, useState } from "react";
import { PackageSearch, Search } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";

type Row = Record<string, any>;

export function CrmStockAvailability({ lang }: { lang?: string }) {
  const s = useErpScreen("cstock", lang);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ lang: s.lang, limit: "100" });
      if (q.trim()) params.set("q", q.trim());
      const res = await apiGet<{ balances: Row[] }>(`/api/erp/inventory/balances?${params.toString()}`);
      setRows(res.balances ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
  }, [q, s.lang]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <section dir={s.dir} className="space-y-4" data-testid="cstock-view">
      <header className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-600/10 text-cyan-700 dark:text-cyan-300"><PackageSearch className="h-5 w-5" /></span>
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-50">{s.t("title", "Stock Availability")}</h1>
          <p className="text-xs text-slate-500">{s.t("subtitle", "Real available quantity, read-only. To receive, issue or adjust stock, use the Inventory module.")}</p>
        </div>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={s.t("search_ph", "Search goods name or CHS code...")}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 dark:border-slate-700 dark:bg-slate-800"
        />
      </div>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="px-3 py-2.5 font-bold">{s.t("th_goods", "Goods")}</th>
              <th className="px-3 py-2.5 font-bold">{s.t("th_warehouse", "Warehouse")}</th>
              <th className="px-3 py-2.5 font-bold">{s.t("th_country", "Country")}</th>
              <th className="px-3 py-2.5 text-right font-bold">{s.t("th_available", "Available")}</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">{s.t("loading", "Loading...")}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">{s.t("empty", "No matching stock found.")}</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{r.goods_name || "—"}<span className="ms-1 font-mono text-[10px] text-slate-400">{r.chs_code}</span></td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.warehouse_name || "—"}</td>
                <td className="px-3 py-2 text-slate-500">{r.country_name || "—"}</td>
                <td className="px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-300">{Number(r.quantity_available || 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
