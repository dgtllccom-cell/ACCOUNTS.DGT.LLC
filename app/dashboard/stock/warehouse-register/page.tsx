"use client";

import { useEffect, useMemo, useState } from "react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import type { WarehouseBalanceRow } from "@/lib/stock/warehouse-register";

type Totals = { lines: number; onHand: number; reserved: number; available: number };

export default function WarehouseStockRegisterPage() {
  const lang = useActiveLanguage();
  const t = (label: string) => translateHeader(lang, label);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [rows, setRows] = useState<WarehouseBalanceRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ lines: 0, onHand: 0, reserved: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/erp/stock/warehouse-register", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body?.ok) throw new Error("load failed");
        if (!cancelled) {
          setRows(body.data.rows);
          setTotals(body.data.totals);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.warehouseName, r.goodsName, r.countryName].some((v) => v.toLowerCase().includes(q)));
  }, [rows, query]);

  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-black text-blue-800 dark:text-blue-300">{t("WAREHOUSE STOCK REGISTER")}</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("SEARCH")}
          className="h-9 w-64 rounded-lg border border-slate-300 bg-white px-3 text-xs"
        />
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="text-[11px] font-bold uppercase text-slate-500">{t("ON HAND")}</div>
          <div className="font-mono text-xl font-black">{fmt(totals.onHand)}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-[11px] font-bold uppercase text-slate-500">{t("RESERVED")}</div>
          <div className="font-mono text-xl font-black">{fmt(totals.reserved)}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-[11px] font-bold uppercase text-slate-500">{t("AVAILABLE")}</div>
          <div className="font-mono text-xl font-black">{fmt(totals.available)}</div>
        </div>
      </section>

      {failed && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
          {t("WAREHOUSE STOCK COULD NOT BE LOADED. PRESS REFRESH TO TRY AGAIN.")}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-slate-100 text-[11px] font-black uppercase text-slate-700">
            <tr>
              <th className="px-3 py-2 text-start">{t("WAREHOUSE")}</th>
              <th className="px-3 py-2 text-start">{t("COUNTRY")}</th>
              <th className="px-3 py-2 text-start">{t("GOODS NAME")}</th>
              <th className="px-3 py-2 text-end">{t("ON HAND")}</th>
              <th className="px-3 py-2 text-end">{t("RESERVED")}</th>
              <th className="px-3 py-2 text-end">{t("AVAILABLE")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">{t("LOADING")}</td>
              </tr>
            )}
            {!loading && !failed && shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">{t("NO STOCK IN WAREHOUSES YET")}</td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={`${r.warehouseId}-${r.goodsId}`} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{r.warehouseName}</td>
                <td className="px-3 py-2">{r.countryName}</td>
                <td className="px-3 py-2">{r.goodsName}</td>
                <td className="px-3 py-2 text-end font-mono">{fmt(r.onHand)}</td>
                <td className="px-3 py-2 text-end font-mono">{fmt(r.reserved)}</td>
                <td className="px-3 py-2 text-end font-mono font-bold">{fmt(r.available)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        {t("STOCK ENTERS THIS REGISTER ONLY THROUGH A CONFIRMED WAREHOUSE TRANSFER.")}
      </p>
    </div>
  );
}
