"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

/* Shapes returned by GET /api/erp/stock/lot-register (see lib/services/lot-register-service.ts). */
export type LotFlowRow = {
  source: "local_lot" | "booking" | "unrecorded";
  id: string;
  lotKey: string;
  warehouseId: string;
  kind: "received" | "transfer_in" | "transfer_out" | "exported" | "sold";
  qty: number;
  date: string;
  refNo: string;
  note: string;
};
export type FlowView = LotFlowRow & { container: string; seal: string; transport: string };
export type LotRegisterRow = {
  key: string;
  lotKey: string;
  source: LotFlowRow["source"];
  goodsId: string;
  goodsName: string;
  brand: string;
  size: string;
  origin: string;
  lotName: string | null;
  lotNo: string | null;
  notRecorded: boolean;
  billNo: string;
  billId: string;
  unit: string;
  warehouseId: string;
  warehouseName: string;
  firstReceiptDate: string | null;
  purchased: number;
  received: number;
  transferredIn: number;
  transferredOut: number;
  exported: number;
  sold: number;
  available: number;
  byState: number | null;
  check: number | null;
  gross: number | null;
  net: number | null;
  negative: boolean;
  flows: LotFlowRow[];
};
export type LotRegisterData = {
  rows: LotRegisterRow[];
  flowViews: Record<string, FlowView>;
  totals: { activeLots: number; received: number; sold: number; available: number };
  reconciliation: { goodsId: string; warehouseId: string; goodsName: string; warehouseName: string; balanceOnHand: number; lotsAvailable: number; difference: number }[];
  mirrorsSkipped: number;
  generatedAt: string;
};

type T = (label: string) => string;

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
const DASH = "—";

/** Loads the lot register once for the page. */
export function useLotRegister() {
  const [data, setData] = useState<LotRegisterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetch("/api/erp/stock/lot-register", { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body?.ok) throw new Error("load failed");
        if (!cancelled) setData(body.data as LotRegisterData);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { data, loading, failed };
}

function Kpi({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: "blue" | "amber" | "rose" | "emerald" }) {
  const tones = { blue: "border-blue-200 bg-blue-50", amber: "border-amber-200 bg-amber-50", rose: "border-rose-200 bg-rose-50", emerald: "border-emerald-200 bg-emerald-50" } as const;
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

const lotLabel = (r: { lotName: string | null }, t: T) => r.lotName || t("LOT NOT RECORDED");

/** Current Stock: one row per lot and warehouse, the lot's original record, its balance, and the View. */
export function CurrentStockTab({ data, loading, failed, t, isRtl }: { data: LotRegisterData | null; loading: boolean; failed: boolean; t: T; isRtl: boolean }) {
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) =>
      !q || [r.lotName, r.lotNo, r.goodsName, r.brand, r.size, r.billNo, r.warehouseName, r.origin].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [data, q]);

  const open = data && openKey ? data.rows.find((r) => r.key === openKey) ?? null : null;
  const hasDifferences = (data?.reconciliation ?? []).some((r) => Math.abs(r.difference) > 0.0001);

  if (loading) return <p className="p-4 text-center text-[12px] text-slate-500">{t("LOADING")}</p>;
  if (failed || !data) return <p className="rounded-md border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-800">{t("WAREHOUSE STOCK COULD NOT BE LOADED. PRESS REFRESH TO TRY AGAIN.")}</p>;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-3">
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi label={t("ACTIVE LOTS")} value={fmt(data.totals.activeLots)} unit={t("LOTS")} tone="blue" />
        <Kpi label={t("RECEIVED")} value={fmt(data.totals.received)} unit="" tone="amber" />
        <Kpi label={t("SOLD")} value={fmt(data.totals.sold)} unit="" tone="rose" />
        <Kpi label={t("AVAILABLE")} value={fmt(data.totals.available)} unit="" tone="emerald" />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("SEARCH LOT, GOODS, BILL OR WAREHOUSE")}
          className="h-8 min-w-[220px] flex-1 rounded-md border border-slate-300 px-2 text-[12px] text-black"
        />
        <span className="text-[11px] text-slate-600">
          {t("MIRRORS SKIPPED")}: <span className="font-mono font-bold">{fmt(data.mirrorsSkipped)}</span>
        </span>
      </div>

      <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-auto">
          <table className="w-full min-w-[1200px] text-[11px]">
            <thead className="sticky top-0 z-10 bg-teal-50 text-[10px] font-black uppercase text-slate-700">
              <tr>
                <th className="px-2 py-1 text-start">{t("FIRST WAREHOUSE RECEIPT")}</th>
                <th className="px-2 py-1 text-start">{t("LOT NAME")}</th>
                <th className="px-2 py-1 text-start">{t("LOT NO.")}</th>
                <th className="px-2 py-1 text-start">{t("GOODS NAME")}</th>
                <th className="px-2 py-1 text-start">{t("BRAND")}</th>
                <th className="px-2 py-1 text-start">{t("SIZE")}</th>
                <th className="px-2 py-1 text-end">{t("AVAILABLE QTY")}</th>
                <th className="px-2 py-1 text-end">{t("GROSS (KG)")}</th>
                <th className="px-2 py-1 text-end">{t("NET (KG)")}</th>
                <th className="px-2 py-1 text-start">{t("ORIGIN")}</th>
                <th className="px-2 py-1 text-start">{t("VIEW")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-2 py-4 text-center text-slate-500">{t("NO CURRENT STOCK")}</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.key} className={`border-t border-slate-100 ${r.negative ? "bg-rose-50" : ""}`}>
                  <td className="whitespace-nowrap px-2 py-1 text-black">
                    <div className="font-mono font-semibold">{r.firstReceiptDate || DASH}</div>
                    <div className="text-[10px] text-slate-600">{r.warehouseName || DASH}</div>
                  </td>
                  <td className={`px-2 py-1 font-semibold ${r.notRecorded ? "text-amber-700" : "text-black"}`}>{lotLabel(r, t)}</td>
                  <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{r.lotNo || DASH}</td>
                  <td className="px-2 py-1 font-black text-black">{r.goodsName || DASH}</td>
                  <td className="px-2 py-1 text-black">{r.brand || DASH}</td>
                  <td className="px-2 py-1 text-black">{r.size || DASH}</td>
                  <td className="whitespace-nowrap px-2 py-1 text-end font-mono font-black text-black">
                    {fmt(r.available)} <span className="text-[10px] font-bold text-slate-600">{r.unit}</span>
                    {r.check != null && Math.abs(r.check) > 0.0001 && <span className="ms-1 rounded bg-rose-600 px-1 text-[9px] font-black text-white">{t("CHECK")}</span>}
                  </td>
                  <td className="px-2 py-1 text-end font-mono text-black">{r.gross == null ? DASH : fmt(r.gross)}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{r.net == null ? DASH : fmt(r.net)}</td>
                  <td className="px-2 py-1 text-black">{r.origin || DASH}</td>
                  <td className="px-2 py-1">
                    <button type="button" onClick={() => setOpenKey(r.key)} className="rounded border border-teal-300 bg-teal-50 px-1.5 py-0.5 text-[10px] font-black text-teal-900">
                      {t("VIEW")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="bg-slate-100 px-3 py-1.5 text-[11px] font-black uppercase text-slate-700">
          {t("BALANCE CHECK")} {hasDifferences ? "" : `— ${t("ALL EXPLAINED")}`}
        </h2>
        <div className="overflow-auto">
          <table className="w-full min-w-[700px] text-[11px]">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-600">
              <tr>
                <th className="px-2 py-1 text-start">{t("GOODS NAME")}</th>
                <th className="px-2 py-1 text-start">{t("WAREHOUSE")}</th>
                <th className="px-2 py-1 text-end">{t("BALANCE ON HAND")}</th>
                <th className="px-2 py-1 text-end">{t("LOTS AVAILABLE")}</th>
                <th className="px-2 py-1 text-end">{t("DIFFERENCE")}</th>
              </tr>
            </thead>
            <tbody>
              {data.reconciliation.map((r) => (
                <tr key={`${r.goodsId}|${r.warehouseId}`} className="border-t border-slate-100">
                  <td className="px-2 py-1 text-black">{r.goodsName || DASH}</td>
                  <td className="px-2 py-1 text-black">{r.warehouseName || DASH}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(r.balanceOnHand)}</td>
                  <td className="px-2 py-1 text-end font-mono text-black">{fmt(r.lotsAvailable)}</td>
                  <td className={`px-2 py-1 text-end font-mono font-bold ${Math.abs(r.difference) > 0.0001 ? "text-rose-700" : "text-emerald-700"}`}>{fmt(r.difference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {open && <LotView row={open} flowViews={data.flowViews} t={t} isRtl={isRtl} onClose={() => setOpenKey(null)} />}
    </div>
  );
}

/** Sales tab: every sale and export deduction, once each, from the same flows as Current Stock. */
export function SalesTab({ data, loading, failed, t, isRtl }: { data: LotRegisterData | null; loading: boolean; failed: boolean; t: T; isRtl: boolean }) {
  const list = useMemo(() => {
    if (!data) return [];
    return data.rows
      .flatMap((r) => r.flows.filter((f) => f.kind === "sold" || f.kind === "exported").map((f) => ({ f, r })))
      .sort((a, b) => a.f.date.localeCompare(b.f.date) || a.f.refNo.localeCompare(b.f.refNo));
  }, [data]);
  if (loading) return <p className="p-4 text-center text-[12px] text-slate-500">{t("LOADING")}</p>;
  if (failed || !data) return <p className="rounded-md border border-rose-300 bg-rose-50 p-2 text-[11px] text-rose-800">{t("WAREHOUSE STOCK COULD NOT BE LOADED. PRESS REFRESH TO TRY AGAIN.")}</p>;
  const total = list.reduce((s, x) => s + x.f.qty, 0);
  return (
    <section dir={isRtl ? "rtl" : "ltr"} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-auto">
        <table className="w-full min-w-[1000px] text-[11px]">
          <thead className="sticky top-0 z-10 bg-teal-50 text-[10px] font-black uppercase text-slate-700">
            <tr>
              <th className="px-2 py-1 text-start">{t("DATE")}</th>
              <th className="px-2 py-1 text-start">{t("TYPE")}</th>
              <th className="px-2 py-1 text-start">{t("REFERENCE")}</th>
              <th className="px-2 py-1 text-start">{t("LOT NAME")}</th>
              <th className="px-2 py-1 text-start">{t("LOT NO.")}</th>
              <th className="px-2 py-1 text-start">{t("GOODS NAME")}</th>
              <th className="px-2 py-1 text-start">{t("WAREHOUSE")}</th>
              <th className="px-2 py-1 text-start">{t("ORIGINAL PURCHASE BILL")}</th>
              <th className="px-2 py-1 text-end">{t("QTY")}</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-4 text-center text-slate-500">{t("NO SALES RECORDED")}</td>
              </tr>
            )}
            {list.map(({ f, r }) => (
              <tr key={`${f.source}|${f.id}|${f.kind}`} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{f.date || DASH}</td>
                <td className="px-2 py-1 font-semibold text-black">{f.kind === "exported" ? t("EXPORTED") : t("SOLD")}</td>
                <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{f.refNo || DASH}</td>
                <td className={`px-2 py-1 ${r.notRecorded ? "text-amber-700" : "text-black"}`}>{lotLabel(r, t)}</td>
                <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{r.lotNo || DASH}</td>
                <td className="px-2 py-1 text-black">{r.goodsName || DASH}</td>
                <td className="px-2 py-1 text-black">{r.warehouseName || DASH}</td>
                <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{r.billNo || DASH}</td>
                <td className="whitespace-nowrap px-2 py-1 text-end font-mono font-bold text-black">{fmt(f.qty)} {r.unit}</td>
              </tr>
            ))}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-emerald-300 bg-emerald-100 font-black">
                <td className="px-2 py-1 text-black" colSpan={8}>{t("TOTAL")}</td>
                <td className="px-2 py-1 text-end font-mono text-black">{fmt(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200">
      <h3 className="bg-teal-50 px-3 py-1 text-[11px] font-black uppercase text-teal-900">{title}</h3>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

/** View: the original purchase bill, the dated receipts with containers, seals and transport, the deductions, and what is left. */
function LotView({ row, flowViews, t, isRtl, onClose }: { row: LotRegisterRow; flowViews: Record<string, FlowView>; t: T; isRtl: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const flowsOf = (kinds: LotFlowRow["kind"][]) => row.flows.filter((f) => kinds.includes(f.kind));
  const receipts = flowsOf(["received", "transfer_in"]);
  const deductions = flowsOf(["sold", "exported", "transfer_out"]);
  const view = (f: LotFlowRow): Partial<FlowView> => flowViews[`${f.source}|${f.id}`] ?? {};
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3" role="dialog" aria-modal="true" dir={isRtl ? "rtl" : "ltr"}>
      <div className="mt-6 w-full max-w-5xl space-y-3 rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-black text-black">
            {t("VIEW — LOT DETAILS")} · {lotLabel(row, t)} · {row.goodsName || DASH}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1 text-[11px] font-bold text-slate-700">
            {t("CLOSE")}
          </button>
        </div>

        <Block title={`1. ${t("ORIGINAL PURCHASE BILL")}`}>
          <table className="w-full text-[11px]">
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-2 py-1 font-semibold text-slate-600">{t("PURCHASE NO.")}</td>
                <td className="px-2 py-1 font-mono text-black">{row.billNo || DASH}</td>
                <td className="px-2 py-1 font-semibold text-slate-600">{t("GOODS NAME")}</td>
                <td className="px-2 py-1 text-black">{row.goodsName || DASH}</td>
                <td className="px-2 py-1 font-semibold text-slate-600">{t("BRAND")}</td>
                <td className="px-2 py-1 text-black">{row.brand || DASH}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-2 py-1 font-semibold text-slate-600">{t("SIZE")}</td>
                <td className="px-2 py-1 text-black">{row.size || DASH}</td>
                <td className="px-2 py-1 font-semibold text-slate-600">{t("ORIGIN")}</td>
                <td className="px-2 py-1 text-black">{row.origin || DASH}</td>
                <td className="px-2 py-1 font-semibold text-slate-600">{t("LOT NO.")}</td>
                <td className="px-2 py-1 font-mono text-black">{row.lotNo || DASH}</td>
              </tr>
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-2 p-2 lg:grid-cols-5">
            <Kpi label={t("PURCHASED")} value={fmt(row.purchased)} unit={row.unit} tone="blue" />
            <Kpi label={t("RECEIVED")} value={fmt(row.received + row.transferredIn)} unit={row.unit} tone="amber" />
            <Kpi label={t("TRANSFERRED OUT")} value={fmt(row.transferredOut)} unit={row.unit} tone="amber" />
            <Kpi label={t("SOLD")} value={fmt(row.sold + row.exported)} unit={row.unit} tone="rose" />
            <Kpi label={t("AVAILABLE")} value={fmt(row.available)} unit={row.unit} tone="emerald" />
          </div>
        </Block>

        <Block title={`2. ${t("RECEIPT & TRANSPORT HISTORY")}`}>
          <table className="w-full min-w-[900px] text-[11px]">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-600">
              <tr>
                <th className="px-2 py-1 text-start">{t("DATE")}</th>
                <th className="px-2 py-1 text-start">{t("REFERENCE")}</th>
                <th className="px-2 py-1 text-start">{t("TYPE")}</th>
                <th className="px-2 py-1 text-start">{t("CONTAINER NUMBER")}</th>
                <th className="px-2 py-1 text-start">{t("SEAL NUMBERS")}</th>
                <th className="px-2 py-1 text-start">{t("TRANSPORT")}</th>
                <th className="px-2 py-1 text-end">{t("QTY")}</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-3 text-center text-slate-500">{t("NO RECEIPTS RECORDED")}</td>
                </tr>
              )}
              {receipts.map((f) => {
                const v = view(f);
                return (
                  <tr key={`${f.source}|${f.id}|r`} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{f.date || DASH}</td>
                    <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{f.refNo || DASH}</td>
                    <td className="px-2 py-1 text-black">{f.kind === "transfer_in" ? t("TRANSFERRED IN") : t("RECEIVED")}</td>
                    <td className="px-2 py-1 font-mono text-black">{v.container || DASH}</td>
                    <td className="px-2 py-1 font-mono text-black">{v.seal || DASH}</td>
                    <td className="px-2 py-1 text-black">{v.transport || DASH}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-end font-mono font-bold text-black">{fmt(f.qty)} {row.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Block>

        <Block title={`3. ${t("SALES DEDUCTIONS")}`}>
          <table className="w-full min-w-[800px] text-[11px]">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-600">
              <tr>
                <th className="px-2 py-1 text-start">{t("DATE")}</th>
                <th className="px-2 py-1 text-start">{t("REFERENCE")}</th>
                <th className="px-2 py-1 text-start">{t("TYPE")}</th>
                <th className="px-2 py-1 text-end">{t("QTY")}</th>
              </tr>
            </thead>
            <tbody>
              {deductions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-center text-slate-500">{t("NO DEDUCTIONS")}</td>
                </tr>
              )}
              {deductions.map((f) => (
                <tr key={`${f.source}|${f.id}|d`} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{f.date || DASH}</td>
                  <td className="whitespace-nowrap px-2 py-1 font-mono text-black">{f.refNo || DASH}</td>
                  <td className="px-2 py-1 text-black">
                    {f.kind === "sold" ? t("SOLD") : f.kind === "exported" ? t("EXPORTED") : t("TRANSFERRED OUT")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-end font-mono font-bold text-black">{fmt(f.qty)} {row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>

        <Block title={`4. ${t("REMAINING BALANCE")}`}>
          <div className="space-y-1 p-3 text-[12px] text-black">
            <div className="font-mono">
              {fmt(row.received + row.transferredIn)} − {fmt(row.transferredOut + row.exported + row.sold)} = <span className="font-black">{fmt(row.available)} {row.unit}</span>
            </div>
            <div className="text-[11px] text-slate-600">
              {row.gross == null ? `${t("GROSS (KG)")}: ${DASH}` : `${t("GROSS (KG)")}: ${fmt(row.gross)}`} · {row.net == null ? `${t("NET (KG)")}: ${DASH}` : `${t("NET (KG)")}: ${fmt(row.net)}`}
            </div>
            {row.byState != null && (
              <div className={`text-[11px] ${row.check && Math.abs(row.check) > 0.0001 ? "font-bold text-rose-700" : "text-emerald-700"}`}>
                {t("STOCK ON RECORD (LOT)")}: {fmt(row.byState)} · {t("CHECK")}: {fmt(row.check ?? 0)}
              </div>
            )}
          </div>
        </Block>
      </div>
    </div>
  );
}
