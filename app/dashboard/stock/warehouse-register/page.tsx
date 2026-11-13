"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { translateHeader } from "@/lib/i18n/table-headers";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import {
  branchLabel,
  groupPurchases,
  groupRegister,
  type LoadEntry,
  type RegisterGroup,
  type WarehouseBalanceRow,
} from "@/lib/stock/warehouse-register";

type LoadTotals = { bills: number; loaded: number; inLanes: number };

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
const DASH = "—";

function Kpi({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: "blue" | "amber" | "rose" | "emerald" }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    emerald: "border-emerald-200 bg-emerald-50",
  } as const;
  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <div className="text-[10px] font-bold uppercase text-slate-600">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-mono text-lg font-black text-black">{value}</span>
        {unit && <span className="text-[10px] font-bold uppercase text-slate-600">{unit}</span>}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <h2 className="bg-teal-800 px-3 py-1.5 text-[11px] font-black uppercase text-white">{title}</h2>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export default function WarehouseStockRegisterPage() {
  const lang = useActiveLanguage();
  const t = (label: string) => translateHeader(lang, label);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const [rows, setRows] = useState<WarehouseBalanceRow[]>([]);
  const [loads, setLoads] = useState<LoadEntry[]>([]);
  const [loadTotals, setLoadTotals] = useState<LoadTotals>({ bills: 0, loaded: 0, inLanes: 0 });
  const [totals, setTotals] = useState({ lines: 0, onHand: 0, reserved: 0, available: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [openPurchases, setOpenPurchases] = useState<Set<string>>(new Set());

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
          setLoads(body.data.loads ?? []);
          setLoadTotals(body.data.loadTotals ?? { bills: 0, loaded: 0, inLanes: 0 });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setLoads([]);
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

  // Summary panels use every balance row the caller can see; the search box filters the details table only.
  const adminRows = useMemo(() => rows, [rows]);
  const countryGroups: RegisterGroup[] = useMemo(() => groupRegister(adminRows, (r) => r.countryName, (r) => r.countryName), [adminRows]);
  const branchGroups: RegisterGroup[] = useMemo(
    () => groupRegister(adminRows, (r) => `${r.countryBranchId}|${r.cityBranchId}`, branchLabel),
    [adminRows]
  );

  const shownLoads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return loads;
    return loads.filter((e) =>
      [e.purchaseRef, e.loadingNo, e.goodsName, e.countryName, branchLabel(e)].some((v) => v.toLowerCase().includes(q))
    );
  }, [loads, query]);
  const purchases = useMemo(() => groupPurchases(shownLoads), [shownLoads]);

  const unitLabel = useMemo(() => {
    const units = [...new Set(loads.map((e) => e.unit).filter(Boolean))];
    return units.length === 1 ? units[0] : "";
  }, [loads]);

  const grand = useMemo(
    () =>
      purchases.reduce(
        (s, p) => ({ qty: s.qty + p.qty, gross: s.gross + p.gross, net: s.net + p.net, balance: s.balance + p.balance }),
        { qty: 0, gross: 0, net: 0, balance: 0 }
      ),
    [purchases]
  );

  // The first purchase opens by default, as in the approved reference.
  const firstRef = purchases[0]?.purchaseRef;
  const isOpen = (ref: string) => openPurchases.has(ref) || (openPurchases.size === 0 && ref === firstRef);
  const toggle = (ref: string) =>
    setOpenPurchases((prev) => {
      const base = prev.size === 0 && firstRef ? new Set([firstRef]) : new Set(prev);
      if (base.has(ref)) base.delete(ref);
      else base.add(ref);
      return base;
    });

  const emptyText = t("NO STOCK IN WAREHOUSES YET");

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="w-full space-y-3 p-3 md:p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-black text-black">{t("WAREHOUSE STOCK REGISTER")}</h1>
          <p className="text-[11px] text-slate-500">{t("PURCHASE • LOT • LOADING • TRANSFER • STOCK BALANCE")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("SEARCH")}
            className="h-8 w-56 rounded-md border border-slate-300 bg-white px-2 text-[11px]"
          />
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            className="h-8 rounded-md border border-slate-300 bg-white px-3 text-[11px] font-semibold disabled:opacity-50"
          >
            {t("REFRESH")}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-8 rounded-md bg-teal-800 px-3 text-[11px] font-bold text-white"
          >
            {t("PRINT")}
          </button>
        </div>
      </header>

      {failed && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-800">
          {t("WAREHOUSE STOCK COULD NOT BE LOADED. PRESS REFRESH TO TRY AGAIN.")}
        </div>
      )}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label={t("TOTAL PURCHASE")} value={fmt(loadTotals.bills)} unit={t("BILLS")} tone="blue" />
        <Kpi label={t("TOTAL LOADING")} value={fmt(loadTotals.loaded)} unit={unitLabel} tone="amber" />
        <Kpi label={t("REMAINING")} value={fmt(loadTotals.inLanes)} unit={unitLabel} tone="rose" />
        <Kpi label={t("WAREHOUSE STOCK (AVAILABLE)")} value={fmt(totals.available)} unit={unitLabel} tone="emerald" />
      </section>

      {!loading && (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Panel title={`${t("SUPER ADMIN")} — ${t("ALL COUNTRIES")}`}>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                <tr>
                  <th className="px-2 py-1 text-start">{t("STOCK TYPE")}</th>
                  <th className="px-2 py-1 text-end">{t("QUANTITY")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-2 py-1 text-black">{t("ON HAND")}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(totals.onHand)}</td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="px-2 py-1 text-black">{t("RESERVED")}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(totals.reserved)}</td>
                </tr>
                <tr className="border-t border-emerald-200 bg-emerald-100 font-black">
                  <td className="px-2 py-1 text-black">{t("AVAILABLE")}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(totals.available)}</td>
                </tr>
              </tbody>
            </table>
          </Panel>

          <Panel title={t("COUNTRY ADMIN")}>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                <tr>
                  <th className="px-2 py-1 text-start">{t("COUNTRY")}</th>
                  <th className="px-2 py-1 text-end">{t("AVAILABLE")}</th>
                </tr>
              </thead>
              <tbody>
                {countryGroups.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-2 py-3 text-center text-slate-500">{emptyText}</td>
                  </tr>
                )}
                {countryGroups.map((g) => (
                  <tr key={g.key} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-black">{g.label}</td>
                    <td className="px-2 py-1 text-end font-mono text-black">{fmt(g.available)}</td>
                  </tr>
                ))}
                <tr className="border-t border-emerald-200 bg-emerald-100 font-black">
                  <td className="px-2 py-1 text-black">{t("TOTAL")}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(totals.available)}</td>
                </tr>
              </tbody>
            </table>
          </Panel>

          <Panel title={t("BRANCH SUMMARY")}>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                <tr>
                  <th className="px-2 py-1 text-start">{t("BRANCH (MAIN / CITY)")}</th>
                  <th className="px-2 py-1 text-end">{t("AVAILABLE")}</th>
                </tr>
              </thead>
              <tbody>
                {branchGroups.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-2 py-3 text-center text-slate-500">{emptyText}</td>
                  </tr>
                )}
                {branchGroups.map((g) => (
                  <tr key={g.key} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-black">{g.label}</td>
                    <td className="px-2 py-1 text-end font-mono text-black">{fmt(g.available)}</td>
                  </tr>
                ))}
                <tr className="border-t border-emerald-200 bg-emerald-100 font-black">
                  <td className="px-2 py-1 text-black">{t("TOTAL")}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(totals.available)}</td>
                </tr>
              </tbody>
            </table>
          </Panel>
        </section>
      )}

      <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <h2 className="bg-teal-800 px-3 py-1.5 text-[11px] font-black uppercase text-white">{t("PURCHASE STOCK DETAILS")}</h2>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[1280px] text-[11px]">
            <thead className="sticky top-0 bg-teal-50 text-[10px] font-black uppercase text-slate-700">
              <tr>
                <th className="px-2 py-1 text-start">#</th>
                <th className="px-2 py-1 text-start">{t("PURCHASE NO.")}</th>
                <th className="px-2 py-1 text-start">{t("BRANCH (MAIN / CITY)")}</th>
                <th className="px-2 py-1 text-start">{t("ENTRY NO.")}</th>
                <th className="px-2 py-1 text-start">{t("LOADING DATE")}</th>
                <th className="px-2 py-1 text-start">{t("GOODS NAME")}</th>
                <th className="px-2 py-1 text-start">{t("BRAND")}</th>
                <th className="px-2 py-1 text-start">{t("SIZE")}</th>
                <th className="px-2 py-1 text-start">{t("LOT NAME")}</th>
                <th className="px-2 py-1 text-end">{t("QTY")}</th>
                <th className="px-2 py-1 text-end">{t("GROSS WT (KG)")}</th>
                <th className="px-2 py-1 text-end">{t("NET WT (KG)")}</th>
                <th className="px-2 py-1 text-start">{t("TRANSFER TYPE")}</th>
                <th className="px-2 py-1 text-end">{t("BALANCE (CTN)")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={14} className="px-2 py-4 text-center text-slate-500">{t("LOADING")}</td>
                </tr>
              )}
              {!loading && !failed && purchases.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-2 py-4 text-center text-slate-500">{emptyText}</td>
                </tr>
              )}
              {purchases.map((p, idx) => {
                const open = isOpen(p.purchaseRef);
                const unit = p.entries[0]?.unit ?? "";
                return (
                  <Fragment key={p.purchaseRef}>
                    <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() => toggle(p.purchaseRef)}
                          aria-expanded={open}
                          aria-label={p.purchaseRef}
                          className="me-1 inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-[11px] font-black text-black"
                        >
                          {open ? "−" : "+"}
                        </button>
                        {idx + 1}
                      </td>
                      <td className="px-2 py-1 font-black text-black">{p.purchaseRef}</td>
                      <td className="px-2 py-1 text-black">{p.branchLabel}</td>
                      <td className="px-2 py-1" />
                      <td className="px-2 py-1" />
                      <td className="px-2 py-1 text-black">{p.goodsNames.join(", ")}</td>
                      <td className="px-2 py-1 text-black">{DASH}</td>
                      <td className="px-2 py-1 text-black">{DASH}</td>
                      <td className="px-2 py-1 text-black">{DASH}</td>
                      <td className="px-2 py-1 text-end font-mono text-black">{fmt(p.qty)} {unit}</td>
                      <td className="px-2 py-1 text-end font-mono text-black">{fmt(p.gross)}</td>
                      <td className="px-2 py-1 text-end font-mono text-black">{fmt(p.net)}</td>
                      <td className="px-2 py-1" />
                      <td className={`px-2 py-1 text-end font-mono font-black ${p.balance > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {fmt(p.balance)}
                      </td>
                    </tr>
                    {open &&
                      p.entries.map((e, k) => (
                        <tr key={e.id || `${p.purchaseRef}-${k}`} className="border-t border-slate-100">
                          <td className="px-2 py-1 text-slate-500">{`${idx + 1}.${k + 1}`}</td>
                          <td className="px-2 py-1 text-black">{e.purchaseRef}</td>
                          <td className="px-2 py-1 text-black">{branchLabel(e)}</td>
                          <td className="px-2 py-1 font-mono text-black">{e.loadingNo}</td>
                          <td className="px-2 py-1 font-mono text-black">{e.loadingDate || DASH}</td>
                          <td className="px-2 py-1 text-black">{e.goodsName}</td>
                          <td className="px-2 py-1 text-black">{DASH}</td>
                          <td className="px-2 py-1 text-black">{DASH}</td>
                          <td className="px-2 py-1 text-black">{DASH}</td>
                          <td className="px-2 py-1 text-end font-mono text-black">{fmt(e.qty)} {e.unit}</td>
                          <td className="px-2 py-1 text-end font-mono text-black">{fmt(e.gross)}</td>
                          <td className="px-2 py-1 text-end font-mono text-black">{fmt(e.net)}</td>
                          <td className="px-2 py-1 text-black">{e.transferType}</td>
                          <td className={`px-2 py-1 text-end font-mono font-bold ${e.balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmt(e.balance)}</td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
              {purchases.length > 0 && (
                <tr className="border-t-2 border-emerald-300 bg-emerald-100 font-black">
                  <td className="px-2 py-1" colSpan={9}>
                    <span className="text-black">{t("GRAND TOTAL")}</span>
                  </td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(grand.qty)} {unitLabel}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(grand.gross)}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(grand.net)}</td>
                  <td className="px-2 py-1" />
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(grand.balance)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[10px] text-slate-500">{t("STOCK ENTERS THIS REGISTER ONLY THROUGH A CONFIRMED WAREHOUSE TRANSFER.")}</p>
    </div>
  );
}
