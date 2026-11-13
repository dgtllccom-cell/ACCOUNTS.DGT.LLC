"use client";

import { useEffect, useMemo, useState } from "react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { branchLabel, groupRegister, type RegisterGroup, type WarehouseBalanceRow } from "@/lib/stock/warehouse-register";

type Totals = { lines: number; onHand: number; reserved: number; available: number };

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

function GroupTable({
  title,
  labelHeader,
  groups,
  emptyText,
  t,
}: {
  title: string;
  labelHeader: string;
  groups: RegisterGroup[];
  emptyText: string;
  t: (label: string) => string;
}) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase text-slate-700">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 text-[11px] font-black uppercase text-slate-700">
            <tr>
              <th className="px-3 py-2 text-start">{labelHeader}</th>
              <th className="px-3 py-2 text-end">{t("ON HAND")}</th>
              <th className="px-3 py-2 text-end">{t("RESERVED")}</th>
              <th className="px-3 py-2 text-end">{t("AVAILABLE")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">{emptyText}</td>
              </tr>
            )}
            {groups.map((g) => (
              <tr key={g.key} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-black">{g.label}</td>
                <td className="px-3 py-2 text-end font-mono text-black">{fmt(g.onHand)}</td>
                <td className="px-3 py-2 text-end font-mono text-black">{fmt(g.reserved)}</td>
                <td className="px-3 py-2 text-end font-mono font-bold text-black">{fmt(g.available)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function WarehouseStockRegisterPage() {
  const lang = useActiveLanguage();
  const t = (label: string) => translateHeader(lang, label);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [rows, setRows] = useState<WarehouseBalanceRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ lines: 0, onHand: 0, reserved: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetch(`/api/erp/stock/warehouse-register?lang=${encodeURIComponent(lang)}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body?.ok) throw new Error("load failed");
        if (!cancelled) {
          setRows(body.data.rows);
          setTotals(body.data.totals);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, refreshKey]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.warehouseName, r.goodsName, r.countryName, r.countryBranchName, r.cityBranchName].some((v) => v.toLowerCase().includes(q)));
  }, [rows, query]);

  // Summary tables are built from every row the caller can see (not the search filter).
  const adminGroups = useMemo(() => groupRegister(rows, (r) => r.goodsId, (r) => r.goodsName), [rows]);
  const countryGroups = useMemo(() => groupRegister(rows, (r) => r.countryName, (r) => r.countryName), [rows]);
  const branchGroups = useMemo(
    () => groupRegister(rows, (r) => `${r.countryBranchId}|${r.cityBranchId}`, branchLabel),
    [rows]
  );

  const emptyText = t("NO STOCK IN WAREHOUSES YET");

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="w-full space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-black text-blue-800 dark:text-blue-300">{t("WAREHOUSE STOCK REGISTER")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold disabled:opacity-50"
          >
            {t("REFRESH")}
          </button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("SEARCH")}
            className="h-9 w-64 rounded-lg border border-slate-300 bg-white px-3 text-xs"
          />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="text-[11px] font-bold uppercase text-slate-500">{t("ON HAND")}</div>
          <div className="font-mono text-xl font-black text-black">{fmt(totals.onHand)}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="text-[11px] font-bold uppercase text-slate-500">{t("RESERVED")}</div>
          <div className="font-mono text-xl font-black text-black">{fmt(totals.reserved)}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-[11px] font-bold uppercase text-slate-500">{t("AVAILABLE")}</div>
          <div className="font-mono text-xl font-black text-black">{fmt(totals.available)}</div>
        </div>
      </section>

      {failed && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
          {t("WAREHOUSE STOCK COULD NOT BE LOADED. PRESS REFRESH TO TRY AGAIN.")}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <GroupTable title={t("ADMIN")} labelHeader={t("GOODS NAME")} groups={adminGroups} emptyText={emptyText} t={t} />
          <GroupTable title={t("COUNTRY ADMIN")} labelHeader={t("COUNTRY")} groups={countryGroups} emptyText={emptyText} t={t} />
          <GroupTable title={t("BRANCH")} labelHeader={t("BRANCH")} groups={branchGroups} emptyText={emptyText} t={t} />
        </div>
      )}

      <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-slate-100 text-[11px] font-black uppercase text-slate-700">
            <tr>
              <th className="px-3 py-2 text-start">{t("WAREHOUSE")}</th>
              <th className="px-3 py-2 text-start">{t("COUNTRY")}</th>
              <th className="px-3 py-2 text-start">{t("BRANCH")}</th>
              <th className="px-3 py-2 text-start">{t("GOODS NAME")}</th>
              <th className="px-3 py-2 text-end">{t("ON HAND")}</th>
              <th className="px-3 py-2 text-end">{t("RESERVED")}</th>
              <th className="px-3 py-2 text-end">{t("AVAILABLE")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">{t("LOADING")}</td>
              </tr>
            )}
            {!loading && !failed && shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">{emptyText}</td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={`${r.warehouseId}-${r.goodsId}-${r.countryBranchId}-${r.cityBranchId}`} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-black">{r.warehouseName}</td>
                <td className="px-3 py-2 text-black">{r.countryName}</td>
                <td className="px-3 py-2 text-black">{branchLabel(r)}</td>
                <td className="px-3 py-2 text-black">{r.goodsName}</td>
                <td className="px-3 py-2 text-end font-mono text-black">{fmt(r.onHand)}</td>
                <td className="px-3 py-2 text-end font-mono text-black">{fmt(r.reserved)}</td>
                <td className="px-3 py-2 text-end font-mono font-bold text-black">{fmt(r.available)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">{t("STOCK ENTERS THIS REGISTER ONLY THROUGH A CONFIRMED WAREHOUSE TRANSFER.")}</p>
    </div>
  );
}
