"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { MasterCombo } from "@/components/ui/master-combo";
import { openGenericErpReport } from "@/lib/reports/open-generic-erp-report";
import {
  fetchTempBills,
  createTempBillReq,
  updateTempBillReq,
  deleteTempBillReq,
  type TempBillListRow,
  type TempBillSummary,
  type TempBillInput,
} from "@/features/temp-bills/temp-bills-api";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { Th } from "@/components/ui/translated-th";

const CCY = ["USD", "AED", "PKR", "AFN", "EUR", "GBP", "INR", "CNY", "SAR", "IRR"];
const UNITS = ["kg", "carton", "bag", "ton", "pcs", "box", "pallet"];

type Section = "all" | "purchase" | "sale" | "reports";

export function TempBillsRegisterView({ lang: langProp, section = "all" }: { lang?: string; section?: Section }) {
  const s = useErpScreen("tbill", langProp);
  const { lang, isRtl, dir, textStart, textEnd } = s;

  const [rows, setRows] = useState<TempBillListRow[]>([]);
  const [summary, setSummary] = useState<TempBillSummary>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [setupPending, setSetupPending] = useState(false);

  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const kindFilter = section === "purchase" ? "purchase" : section === "sale" ? "sale" : "";

  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState<TempBillListRow | null>(null);
  const [detail, setDetail] = useState<TempBillListRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchTempBills({ kind: kindFilter, q, fromDate, toDate });
      setRows(data.rows || []);
      setSummary(data.summary || {});
      setSetupPending(Boolean(data.setupPending));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [kindFilter, q, fromDate, toDate]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const money = (n: number | null | undefined, ccy?: string) =>
    n == null ? "—" : `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}${ccy ? " " + ccy : ""}`;
  const numFmt = (n: number | string | null | undefined) => (n == null || n === "" ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 }));

  // group by Party → reference_no (the owner's "Party -> many references -> many bills")
  const grouped = useMemo(() => {
    const byParty = new Map<string, Map<string, TempBillListRow[]>>();
    for (const r of rows) {
      const p = r.party_name || "—";
      const ref = r.reference_no || "—";
      if (!byParty.has(p)) byParty.set(p, new Map());
      const refs = byParty.get(p)!;
      if (!refs.has(ref)) refs.set(ref, []);
      refs.get(ref)!.push(r);
    }
    return byParty;
  }, [rows]);

  const onDelete = async (id: string) => {
    if (!confirm(s.t("confirm_delete", "Delete this temporary bill? This cannot be undone."))) return;
    try {
      await deleteTempBillReq(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const runReport = () => {
    const columns = [
      { key: "bill_date", label: s.t("col_date", "Date"), format: "date" as const },
      { key: "bill_kind", label: s.t("col_kind", "Type") },
      { key: "party_name", label: s.t("col_party", "Party / Account") },
      { key: "reference_no", label: s.t("col_ref", "Reference No") },
      { key: "goods_name", label: s.t("col_goods", "Goods") },
      { key: "bill_no", label: s.t("col_billno", "Bill No") },
      { key: "container_no", label: s.t("col_container", "Container No") },
      { key: "bl_no", label: s.t("col_bl", "BL No") },
      { key: "quantity", label: s.t("col_qty", "Quantity"), align: "right" as const, format: "number" as const },
      { key: "weight_cartons", label: s.t("col_weight", "Weight / Cartons"), align: "right" as const, format: "number" as const },
      { key: "rate", label: s.t("col_rate", "Rate"), align: "right" as const, format: "number" as const },
      { key: "amount", label: s.t("col_amount", "Amount"), align: "right" as const, format: "number" as const },
      { key: "currency_code", label: s.t("col_currency", "Currency") },
      { key: "remarks", label: s.t("col_remarks", "Remarks") },
    ];
    const totalAmt = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    openGenericErpReport({
      title: s.t("report_title", "Temporary Purchase & Sales Bills Register"),
      subtitle: s.t("report_sub", "Historical tracking only — not connected to Ledger / Roznamcha / Journal / Stock"),
      lang: lang as any,
      columns,
      rows: rows.map((r) => ({
        ...r,
        bill_kind: r.bill_kind === "purchase" ? s.t("kind_purchase", "Purchase") : s.t("kind_sale", "Sale"),
      })) as any,
      filters: [
        kindFilter ? { label: s.t("col_kind", "Type"), value: kindFilter } : null,
        fromDate ? { label: s.t("f_from", "From"), value: fromDate } : null,
        toDate ? { label: s.t("f_to", "To"), value: toDate } : null,
        q ? { label: s.t("f_search", "Search"), value: q } : null,
      ].filter(Boolean) as any,
      summary: {
        [s.t("kpi_bills", "Bills")]: rows.length,
        [s.t("kpi_parties", "Parties")]: grouped.size,
        [s.t("kpi_total_amount", "Total Amount")]: totalAmt.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      },
      totalsRow: {
        amount: totalAmt,
      } as any,
    });
  };

  return (
    <section dir={dir} className="space-y-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{s.t("group", "Temporary Bills Register")}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {section === "purchase" ? s.t("title_purchase", "Temporary Purchase Bills")
              : section === "sale" ? s.t("title_sale", "Temporary Sales Bills")
              : section === "reports" ? s.t("title_reports", "Temporary Bills — Reports & Search")
              : s.t("title", "Temporary Purchase & Sales Bills Register")}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {s.t("subtitle", "Historical / temporary tracking only. These bills are NOT main ERP accounting — no Ledger, Roznamcha, Journal, DR/CR, Stock or Voucher posting, and no accounting transfer. The main ERP is used only to pick existing Party / Account and Goods.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={runReport} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted">
            {s.t("btn_report", "Report / Print PDF")}
          </button>
          {section !== "reports" && (
            <button onClick={() => { setEditRow(null); setShowForm(true); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              + {s.t("btn_new", "New Temporary Bill")}
            </button>
          )}
        </div>
      </header>

      {setupPending && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {s.t("setup_pending", "The Temporary Bills Register table is not yet on this database. Run migration 20261114.")}
        </div>
      )}
      {err && <div className="rounded-lg border-2 border-rose-400 bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/40">{err}</div>}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label={s.t("kpi_purchase_bills", "Purchase Bills")} value={String(summary.purchase?.count ?? 0)} tone="blue" />
        <Kpi label={s.t("kpi_purchase_amount", "Purchase Amount")} value={money(summary.purchase?.total)} tone="blue" />
        <Kpi label={s.t("kpi_sale_bills", "Sales Bills")} value={String(summary.sale?.count ?? 0)} tone="emerald" />
        <Kpi label={s.t("kpi_sale_amount", "Sales Amount")} value={money(summary.sale?.total)} tone="emerald" />
      </div>

      {/* filters */}
      <div className="flex flex-col items-stretch gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {s.t("f_search", "Search")}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.t("f_search_ph", "Party, reference, bill no, goods, container…")}
            className={`h-10 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm sm:w-64 ${textStart}`} />
        </label>
        <div className="flex w-full flex-col gap-1 text-xs font-semibold sm:w-auto sm:min-w-[17rem]">
          <span>{s.t("f_date_range", "Date Range")}</span>
          <ErpDatePicker
            mode="range"
            lang={lang}
            size="sm"
            applyLabel="update"
            value={{ from: fromDate || null, to: toDate || null }}
            onApply={(v) => {
              setFromDate(v.from ?? "");
              setToDate(v.to ?? "");
            }}
          />
        </div>
        {(q || fromDate || toDate) && (
          <button onClick={() => { setQ(""); setFromDate(""); setToDate(""); }} className="h-10 rounded-md border border-border px-2.5 text-xs font-semibold hover:bg-muted transition-colors sm:h-9 sm:self-end">
            {s.t("f_reset", "Reset")}
          </button>
        )}
      </div>

      {/* grouped list: Party → reference → bills */}
      {loading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{s.t("loading", "Loading…")}</p>
      ) : grouped.size === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {s.t("empty", "No temporary bills yet. Create the first one.")}
        </p>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([party, refs]) => (
            <div key={party} className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between bg-muted px-3 py-2 text-sm font-bold">
                <span>{party}</span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {[...refs.values()].reduce((a, b) => a + b.length, 0)} {s.t("bills_word", "bills")} · {refs.size} {s.t("refs_word", "references")}
                </span>
              </div>
              {[...refs.entries()].map(([ref, list]) => (
                <div key={ref}>
                  <div className={`bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground ${textStart}`}>
                    {s.t("ref_label", "Reference / Account No")}: <span className="font-mono">{ref}</span>
                  </div>
                  {/* phones: one card per bill so View/Edit/Delete are always reachable */}
                  <ul className="grid divide-y divide-border/60 md:grid-cols-2 md:divide-y-0 xl:hidden">
                    {list.map((r) => (
                      <li key={r.id} className="space-y-2 p-3 md:border-b md:border-border/60">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${r.bill_kind === "purchase" ? "bg-blue-500/15 text-blue-600" : "bg-emerald-500/15 text-emerald-600"}`}>
                            {r.bill_kind === "purchase" ? s.t("kind_purchase", "Purchase") : s.t("kind_sale", "Sale")}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{r.bill_date?.slice(0, 10)}</span>
                        </div>
                        <div className={`text-sm font-semibold ${textStart}`}>{r.goods_name || "—"}</div>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <div className="min-w-0"><dt className="text-muted-foreground">{s.t("col_billno", "Bill No")}</dt><dd className="truncate font-mono">{r.bill_no || "—"}</dd></div>
                          <div className="min-w-0"><dt className="text-muted-foreground">{s.t("col_container", "Container")}</dt><dd className="truncate font-mono">{r.container_no || "—"}</dd></div>
                          <div className="min-w-0"><dt className="text-muted-foreground">{s.t("col_bl", "BL No")}</dt><dd className="truncate font-mono">{r.bl_no || "—"}</dd></div>
                          <div className="min-w-0"><dt className="text-muted-foreground">{s.t("col_qty", "Qty")}</dt><dd className="tabular-nums">{numFmt(r.quantity)}</dd></div>
                          <div className="min-w-0"><dt className="text-muted-foreground">{s.t("col_weight", "Wt/Ctn")}</dt><dd className="tabular-nums">{numFmt(r.weight_cartons)}</dd></div>
                          <div className="min-w-0"><dt className="text-muted-foreground">{s.t("col_amount", "Amount")}</dt><dd className="font-semibold tabular-nums">{money(r.amount, r.currency_code)}</dd></div>
                        </dl>
                        <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => setDetail(r)} className="min-h-10 rounded-md border border-border px-2 text-xs font-semibold">{s.t("act_view", "View")}</button>
                          <button onClick={() => { setEditRow(r); setShowForm(true); }} className="min-h-10 rounded-md border border-border px-2 text-xs font-semibold">{s.t("act_edit", "Edit")}</button>
                          <button onClick={() => onDelete(r.id)} className="min-h-10 rounded-md border border-rose-300 px-2 text-xs font-semibold text-rose-600">{s.t("act_delete", "Delete")}</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto xl:block">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-background text-xs uppercase text-muted-foreground">
                          <Th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_date", "Date")}</Th>
                          <Th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_kind", "Type")}</Th>
                          <Th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_goods", "Goods")}</Th>
                          <Th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_billno", "Bill No")}</Th>
                          <Th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_container", "Container")}</Th>
                          <Th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_bl", "BL No")}</Th>
                          <Th className={`px-2 py-1.5 ${textEnd}`}>{s.t("col_qty", "Qty")}</Th>
                          <Th className={`px-2 py-1.5 ${textEnd}`}>{s.t("col_weight", "Wt/Ctn")}</Th>
                          <Th className={`px-2 py-1.5 ${textEnd}`}>{s.t("col_rate", "Rate")}</Th>
                          <Th className={`px-2 py-1.5 ${textEnd}`}>{s.t("col_amount", "Amount")}</Th>
                          <Th className={`sticky end-0 bg-background px-2 py-1.5 ${textEnd}`}>{s.t("col_actions", "Actions")}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((r) => (
                          <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                            <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs">{r.bill_date?.slice(0, 10)}</td>
                            <td className="px-2 py-1.5">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${r.bill_kind === "purchase" ? "bg-blue-500/15 text-blue-600" : "bg-emerald-500/15 text-emerald-600"}`}>
                                {r.bill_kind === "purchase" ? s.t("kind_purchase", "Purchase") : s.t("kind_sale", "Sale")}
                              </span>
                            </td>
                            <td className={`px-2 py-1.5 ${textStart}`}>{r.goods_name || "—"}</td>
                            <td className="px-2 py-1.5 font-mono text-xs">{r.bill_no || "—"}</td>
                            <td className="px-2 py-1.5 font-mono text-xs">{r.container_no || "—"}</td>
                            <td className="px-2 py-1.5 font-mono text-xs">{r.bl_no || "—"}</td>
                            <td className={`px-2 py-1.5 ${textEnd} tabular-nums`}>{numFmt(r.quantity)}</td>
                            <td className={`px-2 py-1.5 ${textEnd} tabular-nums`}>{numFmt(r.weight_cartons)}</td>
                            <td className={`px-2 py-1.5 ${textEnd} tabular-nums`}>{numFmt(r.rate)}</td>
                            <td className={`px-2 py-1.5 ${textEnd} tabular-nums font-semibold`}>{money(r.amount, r.currency_code)}</td>
                            <td className={`sticky end-0 bg-background px-2 py-1.5 ${textEnd}`}>
                              <div className="flex justify-end gap-1">
                                <button onClick={() => setDetail(r)} className="rounded border border-border px-1.5 py-0.5 text-xs">{s.t("act_view", "View")}</button>
                                <button onClick={() => { setEditRow(r); setShowForm(true); }} className="rounded border border-border px-1.5 py-0.5 text-xs">{s.t("act_edit", "Edit")}</button>
                                <button onClick={() => onDelete(r.id)} className="rounded border border-rose-300 px-1.5 py-0.5 text-xs text-rose-600">{s.t("act_delete", "Delete")}</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TempBillForm
          s={s}
          lang={lang}
          isRtl={isRtl}
          initial={editRow}
          defaultKind={section === "sale" ? "sale" : "purchase"}
          onClose={() => setShowForm(false)}
          onSaved={async () => { setShowForm(false); await load(); }}
        />
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-2 sm:p-4" onClick={() => setDetail(null)}>
          <div dir={dir} className="mt-2 max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm sm:mt-16 sm:max-h-[calc(100dvh-5rem)] sm:p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{s.t("detail_title", "Temporary Bill")}</h3>
              <button onClick={() => setDetail(null)} className="rounded border border-border px-2 py-0.5 text-xs">{s.t("close", "Close")}</button>
            </div>
            <dl className="space-y-1.5">
              <KV k={s.t("f_entry_no", "Entry No")} v={detail.entry_no} mono />
              <KV k={s.t("col_kind", "Type")} v={detail.bill_kind === "purchase" ? s.t("kind_purchase", "Purchase") : s.t("kind_sale", "Sale")} />
              <KV k={s.t("col_party", "Party / Account")} v={detail.party_name} />
              <KV k={s.t("ref_label", "Reference / Account No")} v={detail.reference_no} mono />
              <KV k={s.t("col_goods", "Goods")} v={detail.goods_name} />
              <KV k={s.t("col_billno", "Bill No")} v={detail.bill_no} mono />
              <KV k={s.t("col_container", "Container No")} v={detail.container_no} mono />
              <KV k={s.t("col_bl", "BL No")} v={detail.bl_no} mono />
              <KV k={s.t("col_date", "Date")} v={detail.bill_date?.slice(0, 10)} mono />
              <KV k={s.t("col_qty", "Quantity")} v={numFmt(detail.quantity) + (detail.unit ? " " + detail.unit : "")} />
              <KV k={s.t("col_weight", "Weight / Cartons")} v={numFmt(detail.weight_cartons)} />
              <KV k={s.t("col_rate", "Rate")} v={numFmt(detail.rate)} />
              <KV k={s.t("col_amount", "Amount")} v={money(detail.amount, detail.currency_code)} />
              <KV k={s.t("col_remarks", "Remarks")} v={detail.remarks} />
            </dl>
            {Array.isArray(detail.items) && detail.items.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">{s.t("step_items", "Goods Items")}</h4>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted text-[10px] uppercase text-muted-foreground">
                        <th className={`p-2 ${textStart}`}>{s.t("col_goods", "Goods")}</th>
                        <th className={`p-2 ${textEnd}`}>{s.t("col_qty", "Qty")}</th>
                        <th className={`p-2 ${textEnd}`}>{s.t("col_rate", "Rate")}</th>
                        <th className={`p-2 ${textEnd}`}>{s.t("col_amount", "Amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((it, n) => (
                        <tr key={n} className="border-t border-border">
                          <td className={`p-2 font-semibold ${textStart}`}>{it.goodsName || "—"}</td>
                          <td className={`p-2 tabular-nums ${textEnd}`}>{numFmt(it.quantity)}{it.unit ? ` ${it.unit}` : ""}</td>
                          <td className={`p-2 tabular-nums ${textEnd}`}>{numFmt(it.rate)}</td>
                          <td className={`p-2 font-semibold tabular-nums ${textEnd}`}>{numFmt(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: "blue" | "emerald" }) {
  const c = tone === "blue" ? "border-s-blue-500" : "border-s-emerald-500";
  return (
    <div className={`rounded-lg border border-border border-s-4 ${c} bg-background p-3`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs font-semibold text-muted-foreground">{k}</dt>
      <dd className={mono ? "font-mono text-xs" : "text-sm"}>{v || "—"}</dd>
    </div>
  );
}

function TempBillForm({
  s, lang, isRtl, initial, defaultKind, onClose, onSaved,
}: {
  s: ReturnType<typeof useErpScreen>;
  lang: string;
  isRtl: boolean;
  initial: TempBillListRow | null;
  defaultKind: "purchase" | "sale";
  onClose: () => void;
  onSaved: () => void;
}) {
  type Item = { id: string; goodsId: string | null; goodsName: string; quantity: string; weightCartons: string; unit: string; rate: string; amount: string };
  const newItem = (): Item => ({ id: `it-${Math.random().toString(36).slice(2, 8)}`, goodsId: null, goodsName: "", quantity: "", weightCartons: "", unit: "carton", rate: "", amount: "" });
  const itemFrom = (x: any): Item => ({
    id: `it-${Math.random().toString(36).slice(2, 8)}`,
    goodsId: x?.goodsId ?? x?.goods_id ?? null,
    goodsName: x?.goodsName ?? x?.goods_name ?? "",
    quantity: x?.quantity != null ? String(x.quantity) : "",
    weightCartons: x?.weightCartons != null ? String(x.weightCartons) : (x?.weight_cartons != null ? String(x.weight_cartons) : ""),
    unit: x?.unit ?? "carton",
    rate: x?.rate != null ? String(x.rate) : "",
    amount: x?.amount != null ? String(x.amount) : "",
  });

  const [billKind, setBillKind] = useState<"purchase" | "sale">((initial?.bill_kind as any) || defaultKind);
  const [partyName, setPartyName] = useState(initial?.party_name || "");
  const [partyLinkedId, setPartyLinkedId] = useState<string | null>(initial?.party_account_id ?? null);
  const [referenceNo, setReferenceNo] = useState(initial?.reference_no || "");
  const [billNo, setBillNo] = useState(initial?.bill_no || "");
  const [containerNo, setContainerNo] = useState(initial?.container_no || "");
  const [blNo, setBlNo] = useState(initial?.bl_no || "");
  const [billDate, setBillDate] = useState(initial?.bill_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [currencyCode, setCurrencyCode] = useState(initial?.currency_code || "USD");
  const [remarks, setRemarks] = useState(initial?.remarks || "");
  const [items, setItems] = useState<Item[]>(() => {
    if (Array.isArray(initial?.items) && initial!.items!.length) return initial!.items!.map(itemFrom);
    if (initial && (initial.goods_name || initial.amount != null)) return [itemFrom(initial)];
    return [newItem()];
  });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const errRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (err) errRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [err]);

  const dir = isRtl ? "rtl" : "ltr";
  const isPurchase = billKind === "purchase";
  const setItem = (idx: number, patch: Partial<Item>) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const addItem = () => setItems((p) => [...p, newItem()]);
  const removeItem = (idx: number) => setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p));
  const onQtyRate = (idx: number, k: "quantity" | "rate", v: string) => {
    setItems((p) => p.map((x, i) => {
      if (i !== idx) return x;
      const next = { ...x, [k]: v };
      const q = Number(k === "quantity" ? v : x.quantity), r = Number(k === "rate" ? v : x.rate);
      if (Number.isFinite(q) && Number.isFinite(r) && q && r) next.amount = (q * r).toFixed(2);
      return next;
    }));
  };

  const totalQty = items.reduce((a, i) => a + (Number(i.quantity) || 0), 0);
  const totalWeight = items.reduce((a, i) => a + (Number(i.weightCartons) || 0), 0);
  const totalAmount = items.reduce((a, i) => a + (Number(i.amount) || (Number(i.quantity) || 0) * (Number(i.rate) || 0)), 0);
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const validItems = items.filter((i) => i.goodsName.trim() || i.amount.trim() || i.quantity.trim());

  const buildPayload = (): TempBillInput => {
    const rows = validItems.map((i) => ({
      goodsId: i.goodsId && i.goodsId.length === 36 ? i.goodsId : null,
      goodsName: i.goodsName.trim() || null,
      quantity: i.quantity.trim() ? Number(i.quantity) : null,
      weightCartons: i.weightCartons.trim() ? Number(i.weightCartons) : null,
      unit: i.unit || null,
      rate: i.rate.trim() ? Number(i.rate) : null,
      amount: i.amount.trim() ? Number(i.amount) : (Number(i.quantity) || 0) * (Number(i.rate) || 0) || null,
    }));
    const first = rows[0];
    const aggGoods = rows.length === 0 ? null : rows.length === 1 ? first.goodsName : `${first.goodsName || s.t("item", "Item")} +${rows.length - 1}`;
    return {
      billKind,
      partyName: partyName.trim(),
      partyAccountId: partyLinkedId && partyLinkedId.length === 36 ? partyLinkedId : null,
      referenceNo: referenceNo.trim() || null,
      goodsId: first?.goodsId ?? null,
      goodsName: aggGoods,
      billNo: billNo.trim() || null,
      containerNo: containerNo.trim() || null,
      blNo: blNo.trim() || null,
      billDate: billDate || null,
      quantity: totalQty || null,
      weightCartons: totalWeight || null,
      unit: first?.unit ?? null,
      rate: rows.length === 1 ? (first.rate as any) : null,
      amount: totalAmount || null,
      currencyCode,
      remarks: remarks.trim() || null,
      items: rows,
    };
  };

  const save = async () => {
    setErr(null);
    if (!partyName.trim()) { setErr(s.t("err_party", "Party / Account is required.")); setStep(1); return; }
    if (validItems.length === 0) { setErr(s.t("err_items", "Add at least one goods item.")); setStep(2); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (initial) await updateTempBillReq(initial.id, payload);
      else await createTempBillReq(payload);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const printBill = () => {
    const esc = (v: unknown) => String(v ?? "").replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m] as string));
    const title = isPurchase ? s.t("print_title_purchase", "Arzi Purchase Bill (Temporary)") : s.t("print_title_sale", "Arzi Sales Bill (Temporary)");
    const rowsHtml = validItems.length
      ? validItems.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.goodsName)}</td><td class="r">${esc(i.quantity)}</td><td class="r">${esc(i.weightCartons)}</td><td>${esc(i.unit)}</td><td class="r">${esc(i.rate)}</td><td class="r">${esc(i.amount || ((Number(i.quantity) || 0) * (Number(i.rate) || 0)).toFixed(2))}</td></tr>`).join("")
      : `<tr><td colspan="7" class="muted">—</td></tr>`;
    const head = (k: string, v: unknown) => `<div class="cell"><span class="k">${esc(k)}</span><span class="v">${esc(v || "—")}</span></div>`;
    const align = isRtl ? "right" : "left";
    const html = `<!doctype html><html dir="${isRtl ? "rtl" : "ltr"}" lang="${lang}"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,'Segoe UI',sans-serif;color:#0f172a;font-size:12px}
      h1{font-size:18px;margin:0 0 2px}.note{background:#fff7ed;border:1px solid #fdba74;color:#9a3412;padding:6px 8px;border-radius:6px;font-size:11px;margin:8px 0 14px}
      .head{display:flex;flex-wrap:wrap;gap:4px 24px;margin-bottom:12px}.cell{min-width:180px}.k{color:#64748b;font-weight:600;margin-${isRtl ? "left" : "right"}:6px}.v{font-weight:700}
      table{width:100%;border-collapse:collapse;margin-top:6px}th,td{padding:5px 7px;text-align:${align};border-bottom:1px solid #e2e8f0}
      th{background:#f1f5f9;font-size:10px;text-transform:uppercase}.r{text-align:${isRtl ? "left" : "right"}}.muted{color:#94a3b8}
      tfoot td{font-weight:800;border-top:2px solid #cbd5e1}</style></head><body>
      <h1>${esc(title)}</h1>
      <div class="note">${esc(s.t("print_note", "Temporary / tracking bill only — NOT main ERP accounting. No Ledger, Roznamcha, Journal, DR/CR, Stock or Voucher posting."))}</div>
      <div class="head">
        ${head(s.t("col_party", "Party / Account"), partyName)}
        ${head(s.t("col_billno", "Bill / Reference No"), billNo)}
        ${head(s.t("col_date", "Date"), billDate)}
        ${head(s.t("ref_label", "Reference / Account No"), referenceNo)}
        ${head(s.t("col_container", "Container No"), containerNo)}
        ${head(s.t("col_bl", "BL No"), blNo)}
        ${head(s.t("col_currency", "Currency"), currencyCode)}
      </div>
      <table><thead><tr><th>#</th><th>${esc(s.t("col_goods", "Goods"))}</th><th class="r">${esc(s.t("col_qty", "Quantity"))}</th><th class="r">${esc(s.t("col_weight", "Weight / Cartons"))}</th><th>${esc(s.t("f_unit", "Unit"))}</th><th class="r">${esc(s.t("col_rate", "Rate"))}</th><th class="r">${esc(s.t("col_amount", "Amount"))}</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td colspan="2">${esc(s.t("total", "TOTAL"))}</td><td class="r">${esc(fmt(totalQty))}</td><td class="r">${esc(fmt(totalWeight))}</td><td></td><td></td><td class="r">${esc(currencyCode)} ${esc(fmt(totalAmount))}</td></tr></tfoot></table>
      ${remarks.trim() ? `<p style="margin-top:12px"><b>${esc(s.t("col_remarks", "Remarks"))}:</b> ${esc(remarks)}</p>` : ""}
      </body></html>`;
    const w = window.open("", "_blank", "width=920,height=720");
    if (w) {
      w.document.open(); w.document.write(html); w.document.close();
      const go = () => { try { w.focus(); w.print(); } catch { /* noop */ } };
      if (w.document.readyState === "complete") setTimeout(go, 300); else w.onload = () => setTimeout(go, 200);
    } else {
      const ifr = document.createElement("iframe");
      ifr.setAttribute("aria-hidden", "true");
      ifr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
      document.body.appendChild(ifr);
      const doc = ifr.contentWindow?.document;
      if (doc) { doc.open(); doc.write(html); doc.close(); setTimeout(() => { try { ifr.contentWindow?.focus(); ifr.contentWindow?.print(); } catch { /* noop */ } setTimeout(() => { try { ifr.remove(); } catch { /* noop */ } }, 2000); }, 450); }
      else ifr.remove();
    }
  };

  const input = "rounded-md border border-border bg-background px-2 py-1.5 text-sm w-full";
  const lbl = "flex flex-col gap-1 text-xs font-semibold";
  const steps = [s.t("step_bill", "Bill & Party"), s.t("step_items", "Goods Items"), s.t("step_review", "Review & Save")];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div dir={dir} className="my-4 w-full max-w-6xl rounded-xl border border-border bg-background p-4 sm:p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header + stepper */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${isPurchase ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
              {isPurchase ? s.t("kind_purchase", "Purchase") : s.t("kind_sale", "Sale")}
            </span>
            <h3 className="text-base font-bold">{initial ? s.t("form_edit", "Edit Temporary Bill") : (isPurchase ? s.t("form_new_purchase", "New Arzi Purchase Bill") : s.t("form_new_sale", "New Arzi Sales Bill"))}</h3>
          </div>
          <button onClick={onClose} className="rounded border border-border px-2 py-0.5 text-xs">{s.t("close", "Close")}</button>
        </div>
        <ol className="mb-4 flex min-w-max items-center gap-1 overflow-x-auto text-xs">
          {steps.map((lblx, i) => (
            <li key={i} className="flex items-center gap-1">
              <button type="button" onClick={() => setStep((i + 1) as any)} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold ${step === i + 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step === i + 1 ? "bg-white/25" : "bg-muted"}`}>{i + 1}</span>
                <span className="whitespace-nowrap">{lblx}</span>
              </button>
              {i < 2 && <span className="h-px w-5 bg-border" />}
            </li>
          ))}
        </ol>

        {err && <div ref={errRef} role="alert" className="mb-3 rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">{err}</div>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          {/* LEFT: data entry (step-gated) */}
          <div className="min-w-0 space-y-4">
            {step === 1 && (
              <section className="rounded-xl border border-border p-3">
                <h4 className="mb-3 text-sm font-bold">{s.t("step_bill", "Bill & Party")}</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={lbl}>{s.t("col_kind", "Type")}
                    <select value={billKind} onChange={(e) => setBillKind(e.target.value as any)} className={input}>
                      <option value="purchase">{s.t("kind_purchase", "Purchase")}</option>
                      <option value="sale">{s.t("kind_sale", "Sale")}</option>
                    </select>
                  </label>
                  <div className={lbl}><span>{s.t("col_date", "Date")}</span>
                    <ErpDatePicker mode="single" lang={lang} size="sm" value={{ from: billDate || null }} onApply={(v) => setBillDate(v.from ?? "")} />
                  </div>
                  <div className={`${lbl} sm:col-span-2`}>{s.t("col_party", "Party / Account")}
                    <MasterCombo source="account" lang={lang} value={partyName} linkedId={partyLinkedId}
                      onChange={(name, id) => { setPartyName(name); setPartyLinkedId(id); }}
                      placeholder={s.t("party_ph", "Type or pick an existing Account / Party")} />
                  </div>
                  <label className={lbl}>{s.t("ref_label", "Reference / Account No")}
                    <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className={`${input} font-mono`} />
                  </label>
                  <label className={lbl}>{s.t("col_billno", "Bill / Reference No")}
                    <input value={billNo} onChange={(e) => setBillNo(e.target.value)} className={`${input} font-mono`} />
                  </label>
                  <label className={lbl}>{s.t("col_container", "Container No")} <span className="font-normal text-muted-foreground">({s.t("optional", "optional")})</span>
                    <input value={containerNo} onChange={(e) => setContainerNo(e.target.value)} className={`${input} font-mono`} />
                  </label>
                  <label className={lbl}>{s.t("col_bl", "BL No")} <span className="font-normal text-muted-foreground">({s.t("optional", "optional")})</span>
                    <input value={blNo} onChange={(e) => setBlNo(e.target.value)} className={`${input} font-mono`} />
                  </label>
                  <label className={lbl}>{s.t("col_currency", "Currency")}
                    <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className={input}>
                      {CCY.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="rounded-xl border border-border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold">{s.t("step_items", "Goods Items")}</h4>
                  <button type="button" onClick={addItem} className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">+ {s.t("add_item", "Add Item")}</button>
                </div>
                {/* Desktop table header */}
                <div className="hidden gap-2 px-1 pb-1 text-[10px] font-bold uppercase text-muted-foreground lg:grid lg:grid-cols-[1.6fr_0.8fr_0.9fr_0.7fr_0.8fr_0.9fr_auto]">
                  <span>{s.t("col_goods", "Goods")}</span><span className="text-right">{s.t("col_qty", "Quantity")}</span><span className="text-right">{s.t("col_weight", "Weight / Cartons")}</span><span>{s.t("f_unit", "Unit")}</span><span className="text-right">{s.t("col_rate", "Rate")}</span><span className="text-right">{s.t("col_amount", "Amount")}</span><span></span>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={it.id} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2 lg:grid-cols-[1.6fr_0.8fr_0.9fr_0.7fr_0.8fr_0.9fr_auto] lg:items-center lg:border-0 lg:p-0">
                      <div className="col-span-2 lg:col-span-1">
                        <MasterCombo source="goods" lang={lang} value={it.goodsName} linkedId={it.goodsId}
                          onChange={(name, id) => setItem(idx, { goodsName: name, goodsId: id })}
                          placeholder={s.t("goods_ph", "Type or pick from Goods master")} />
                      </div>
                      <input type="number" inputMode="decimal" onWheel={(e) => e.currentTarget.blur()} value={it.quantity} onChange={(e) => onQtyRate(idx, "quantity", e.target.value)} placeholder={s.t("col_qty", "Quantity")} className={`${input} text-right`} />
                      <input type="number" inputMode="decimal" onWheel={(e) => e.currentTarget.blur()} value={it.weightCartons} onChange={(e) => setItem(idx, { weightCartons: e.target.value })} placeholder={s.t("col_weight", "Weight / Cartons")} className={`${input} text-right`} />
                      <select value={it.unit} onChange={(e) => setItem(idx, { unit: e.target.value })} className={input}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input type="number" inputMode="decimal" onWheel={(e) => e.currentTarget.blur()} value={it.rate} onChange={(e) => onQtyRate(idx, "rate", e.target.value)} placeholder={s.t("col_rate", "Rate")} className={`${input} text-right`} />
                      <input type="number" inputMode="decimal" onWheel={(e) => e.currentTarget.blur()} value={it.amount} onChange={(e) => setItem(idx, { amount: e.target.value })} placeholder={s.t("col_amount", "Amount")} className={`${input} text-right font-semibold`} />
                      <button type="button" aria-label={s.t("remove", "Remove")} onClick={() => removeItem(idx)} disabled={items.length <= 1}
                        className="col-span-2 rounded-md border border-border px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40 lg:col-span-1 lg:px-2">✕</button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-end gap-4 border-t border-border pt-2 text-xs font-bold">
                  <span>{s.t("col_qty", "Quantity")}: {fmt(totalQty)}</span>
                  <span>{s.t("col_amount", "Amount")}: {currencyCode} {fmt(totalAmount)}</span>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="rounded-xl border border-border p-3 space-y-3">
                <h4 className="text-sm font-bold">{s.t("step_review", "Review & Save")}</h4>
                <label className={lbl}>{s.t("col_remarks", "Remarks")}
                  <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className={input} />
                </label>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted text-[10px] uppercase text-muted-foreground">
                      <Th className="p-2 text-start">{s.t("col_goods", "Goods")}</Th><Th className="p-2 text-end">{s.t("col_qty", "Quantity")}</Th><Th className="p-2 text-end">{s.t("col_rate", "Rate")}</Th><Th className="p-2 text-end">{s.t("col_amount", "Amount")}</Th>
                    </tr></thead>
                    <tbody>
                      {validItems.map((i) => (
                        <tr key={i.id} className="border-t border-border"><td className="p-2 font-semibold">{i.goodsName || "—"}</td><td className="p-2 text-end">{i.quantity || "—"}</td><td className="p-2 text-end">{i.rate || "—"}</td><td className="p-2 text-end font-semibold">{i.amount || "—"}</td></tr>
                      ))}
                      {validItems.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">{s.t("err_items", "Add at least one goods item.")}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT: live bill summary (sticky) */}
          <div className="lg:sticky lg:top-2">
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
              <h4 className="mb-2 text-sm font-black">{s.t("bill_summary", "Bill Summary")}</h4>
              <div className="space-y-1.5 text-xs">
                {[
                  [s.t("col_kind", "Type"), isPurchase ? s.t("kind_purchase", "Purchase") : s.t("kind_sale", "Sale")],
                  [s.t("col_party", "Party / Account"), partyName || "—"],
                  [s.t("col_billno", "Bill / Reference No"), billNo || "—"],
                  [s.t("col_date", "Date"), billDate || "—"],
                  [s.t("col_currency", "Currency"), currencyCode],
                  [s.t("items_count", "Items"), String(validItems.length)],
                  [s.t("total_qty", "Total Quantity"), fmt(totalQty)],
                  [s.t("total_weight", "Total Weight / Cartons"), fmt(totalWeight)],
                ].map(([k, v], i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <span className="shrink-0 font-semibold text-muted-foreground">{k}</span>
                    <span className={`min-w-0 break-words font-semibold ${isRtl ? "text-start" : "text-end"}`}>{v}</span>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t border-blue-200 pt-2 dark:border-blue-900/50">
                  <span className="font-bold">{s.t("total_amount", "Total Amount")}</span>
                  <span className="text-base font-black text-blue-700 dark:text-blue-300">{currencyCode} {fmt(totalAmount)}</span>
                </div>
              </div>
              <p className="mt-3 rounded-md bg-amber-50 p-2 text-[10px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                {s.t("form_note", "This bill is stored only in the Temporary Bills Register. It does not post to Ledger, Roznamcha, Journal, DR/CR, Stock or any Voucher, and it is not transferred to the main ERP.")}
              </p>
              <div className="mt-3 grid gap-2">
                <button type="button" onClick={printBill} className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-muted">{s.t("print_pdf", "Print / PDF")}</button>
                <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
                  {saving ? s.t("saving", "Saving…") : (initial ? s.t("save", "Save") : s.t("save_bill", "Save Bill"))}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: step nav */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">{s.t("cancel", "Cancel")}</button>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep((p) => (Math.max(1, p - 1) as any))} disabled={step === 1} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-40">{s.t("back", "Back")}</button>
            {step < 3
              ? <button type="button" onClick={() => setStep((p) => (Math.min(3, p + 1) as any))} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">{s.t("next", "Next")}</button>
              : <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">{saving ? s.t("saving", "Saving…") : s.t("save", "Save")}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
