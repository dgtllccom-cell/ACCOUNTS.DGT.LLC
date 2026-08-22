"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Globe, RefreshCcw, Search } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

function buildTt(lang: string) {
  return (key: string, fb: string) => t((lang || "en") as any, key as any, fb);
}

type OrderRow = {
  id: string;
  purchase_order_no: string;
  purchase_contract_no?: string | null;
  country_id?: string | null;
  country_branch_id?: string | null;
  dest_country_id?: string | null;
  dest_country_branch_id?: string | null;
  currency_code?: string | null;
  order_total?: string | number | null;
  advance_paid?: string | number | null;
  remaining_due?: string | number | null;
  payment_status?: string | null;
  created_at?: string | null;
  countries?: { name?: string } | null;
  country_branches?: { name?: string } | null;
  dest_countries?: { name?: string } | null;
  dest_country_branches?: { name?: string } | null;
  form_data?: { form?: Record<string, any> } | null;
};

function money(value: unknown, currency?: string | null) {
  const amount = Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${amount} ${currency}` : amount;
}

export function CountryTransferRegisterView() {
  const activeLang = useActiveLanguage();
  const tt = buildTt(activeLang);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(activeLang || "en");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/purchases/orders?limit=500", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      const list: OrderRow[] = Array.isArray(body?.data) ? body.data : (body?.data?.orders || []);
      setOrders(list.filter((o) => o.dest_country_id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return orders;
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      const form = o.form_data?.form || {};
      return [o.purchase_order_no, o.purchase_contract_no, form.goodsName, form.supplierName, form.purchaseAccountName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [orders, query]);

  const totalTransferValue = filtered.reduce((sum, o) => sum + Number(o.order_total || 0), 0);

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
            <Globe className="h-5 w-5 text-indigo-600" />
            {tt("ctransfer.title", "Country Transfer Register")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tt("ctransfer.subtitle", "Purchase orders scoped for transfer from a source country/branch to a destination country/branch.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tt("ctransfer.search", "Search PO / goods / supplier...")}
              className="h-9 rounded-lg border border-slate-200 bg-white ps-8 pe-3 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          <button
            onClick={() => void load()}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> {tt("common.refresh", "Refresh")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt("ctransfer.total_transfers", "Total Country Transfers")}</div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{filtered.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt("ctransfer.total_value", "Total Transfer Value")}</div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{money(totalTransferValue)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{tt("common.status", "Status")}</div>
          <div className="text-xl font-black text-emerald-600">{loading ? tt("common.loading", "Loading...") : tt("common.active", "Active")}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr className="text-start text-[10px] font-black uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 text-start">{tt("ctransfer.bill_no", "Bill / PO No.")}</th>
              <th className="px-3 py-2 text-start">{tt("ctransfer.source", "Source Country / Branch")}</th>
              <th className="px-3 py-2 text-start"></th>
              <th className="px-3 py-2 text-start">{tt("ctransfer.destination", "Destination Country / Branch")}</th>
              <th className="px-3 py-2 text-start">{tt("ctransfer.goods", "Goods")}</th>
              <th className="px-3 py-2 text-end">{tt("ctransfer.amount", "Purchase Amount")}</th>
              <th className="px-3 py-2 text-end">{tt("ctransfer.advance", "Advance")}</th>
              <th className="px-3 py-2 text-end">{tt("ctransfer.remaining", "Remaining")}</th>
              <th className="px-3 py-2 text-start">{tt("common.status", "Status")}</th>
              <th className="px-3 py-2 text-start">{tt("common.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                  {tt("ctransfer.empty", "No Country Transfer purchase orders found. Create a Country Purchase with a destination country/branch to see it here.")}
                </td>
              </tr>
            )}
            {filtered.map((o) => {
              const form = o.form_data?.form || {};
              return (
                <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="px-3 py-2 font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    {o.purchase_order_no}
                    {o.purchase_contract_no ? <div className="text-slate-400">{o.purchase_contract_no}</div> : null}
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    {o.countries?.name || "-"}
                    <div className="text-slate-400">{o.country_branches?.name || ""}</div>
                  </td>
                  <td className="px-3 py-2"><ArrowRight className="h-3.5 w-3.5 text-indigo-500" /></td>
                  <td className="px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-300">
                    {o.dest_countries?.name || "-"}
                    <div className="text-slate-400">{o.dest_country_branches?.name || ""}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{form.goodsName || "-"}</td>
                  <td className="px-3 py-2 text-end font-mono font-bold">{money(o.order_total, o.currency_code)}</td>
                  <td className="px-3 py-2 text-end font-mono text-emerald-700 dark:text-emerald-300">{money(o.advance_paid, o.currency_code)}</td>
                  <td className="px-3 py-2 text-end font-mono text-amber-700 dark:text-amber-300">{money(o.remaining_due, o.currency_code)}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {(o.payment_status || "pending").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={`/dashboard/purchase/purchase-loading-records?openRecordId=&purchaseOrderNo=${encodeURIComponent(o.purchase_order_no)}`}
                      className="text-[11px] font-bold text-indigo-600 hover:underline"
                    >
                      {tt("ctransfer.view_loading", "View Loading / Transport")}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
