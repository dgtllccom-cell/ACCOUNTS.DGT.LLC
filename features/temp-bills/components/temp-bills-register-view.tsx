"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const numFmt = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 }));

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
      rows: rows as any,
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
        goods_name: s.t("total", "TOTAL"),
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
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {s.t("f_search", "Search")}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.t("f_search_ph", "Party, reference, bill no, goods, container…")}
            className={`w-64 rounded-md border border-border bg-background px-2 py-1.5 text-sm ${textStart}`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {s.t("f_from", "From")}
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {s.t("f_to", "To")}
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
        </label>
        {(q || fromDate || toDate) && (
          <button onClick={() => { setQ(""); setFromDate(""); setToDate(""); }} className="rounded-md border border-border px-2 py-1.5 text-xs font-semibold">
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
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-background text-xs uppercase text-muted-foreground">
                          <th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_date", "Date")}</th>
                          <th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_kind", "Type")}</th>
                          <th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_goods", "Goods")}</th>
                          <th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_billno", "Bill No")}</th>
                          <th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_container", "Container")}</th>
                          <th className={`px-2 py-1.5 ${textStart}`}>{s.t("col_bl", "BL No")}</th>
                          <th className={`px-2 py-1.5 ${textEnd}`}>{s.t("col_qty", "Qty")}</th>
                          <th className={`px-2 py-1.5 ${textEnd}`}>{s.t("col_weight", "Wt/Ctn")}</th>
                          <th className={`px-2 py-1.5 ${textEnd}`}>{s.t("col_rate", "Rate")}</th>
                          <th className={`px-2 py-1.5 ${textEnd}`}>{s.t("col_amount", "Amount")}</th>
                          <th className={`px-2 py-1.5 ${textEnd}`}>{s.t("col_actions", "Actions")}</th>
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
                            <td className={`px-2 py-1.5 ${textEnd}`}>
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
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div dir={dir} className="mt-16 w-full max-w-lg rounded-xl border border-border bg-background p-5 text-sm" onClick={(e) => e.stopPropagation()}>
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
  const [f, setF] = useState<TempBillInput>(() => ({
    billKind: (initial?.bill_kind as any) || defaultKind,
    partyName: initial?.party_name || "",
    referenceNo: initial?.reference_no || "",
    goodsName: initial?.goods_name || "",
    billNo: initial?.bill_no || "",
    containerNo: initial?.container_no || "",
    blNo: initial?.bl_no || "",
    billDate: initial?.bill_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    quantity: initial?.quantity ?? "",
    weightCartons: initial?.weight_cartons ?? "",
    unit: initial?.unit || "carton",
    rate: initial?.rate ?? "",
    amount: initial?.amount ?? "",
    currencyCode: initial?.currency_code || "USD",
    remarks: initial?.remarks || "",
  }));
  const [partyLinkedId, setPartyLinkedId] = useState<string | null>(null);
  const [goodsLinkedId, setGoodsLinkedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof TempBillInput, v: any) => setF((p) => ({ ...p, [k]: v }));

  // auto-amount = qty * rate when both present and amount untouched
  useEffect(() => {
    const qn = Number(f.quantity), rn = Number(f.rate);
    if (Number.isFinite(qn) && Number.isFinite(rn) && qn && rn) {
      set("amount", (qn * rn).toFixed(2));
    }
  }, [f.quantity, f.rate]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setErr(null);
    if (!f.partyName?.trim()) { setErr(s.t("err_party", "Party / Account is required.")); return; }
    setSaving(true);
    try {
      const payload: TempBillInput = {
        ...f,
        partyAccountId: partyLinkedId && partyLinkedId.length === 36 ? partyLinkedId : null,
        goodsId: goodsLinkedId && goodsLinkedId.length === 36 ? goodsLinkedId : null,
      };
      if (initial) await updateTempBillReq(initial.id, payload);
      else await createTempBillReq(payload);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const dir = isRtl ? "rtl" : "ltr";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div dir={dir} className="my-8 w-full max-w-2xl rounded-xl border border-border bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold">{initial ? s.t("form_edit", "Edit Temporary Bill") : s.t("form_new", "New Temporary Bill")}</h3>
          <button onClick={onClose} className="rounded border border-border px-2 py-0.5 text-xs">{s.t("close", "Close")}</button>
        </div>
        {err && <div className="mb-3 rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700">{err}</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_kind", "Type")}
            <select value={f.billKind} onChange={(e) => set("billKind", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
              <option value="purchase">{s.t("kind_purchase", "Purchase")}</option>
              <option value="sale">{s.t("kind_sale", "Sale")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_date", "Date")}
            <input type="date" value={f.billDate || ""} onChange={(e) => set("billDate", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
          </label>
          <div className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
            {s.t("col_party", "Party / Account")}
            <MasterCombo source="account" lang={lang} value={f.partyName} linkedId={partyLinkedId}
              onChange={(name, id) => { set("partyName", name); setPartyLinkedId(id); }}
              placeholder={s.t("party_ph", "Type or pick an existing Account / Party")} />
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("ref_label", "Reference / Account No")}
            <input value={f.referenceNo || ""} onChange={(e) => set("referenceNo", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono" />
          </label>
          <div className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_goods", "Goods")}
            <MasterCombo source="goods" lang={lang} value={f.goodsName || ""} linkedId={goodsLinkedId}
              onChange={(name, id) => { set("goodsName", name); setGoodsLinkedId(id); }}
              placeholder={s.t("goods_ph", "Type or pick from Goods master")} />
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_billno", "Bill / Reference No")}
            <input value={f.billNo || ""} onChange={(e) => set("billNo", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_container", "Container No")} <span className="font-normal text-muted-foreground">({s.t("optional", "optional")})</span>
            <input value={f.containerNo || ""} onChange={(e) => set("containerNo", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_bl", "BL No")} <span className="font-normal text-muted-foreground">({s.t("optional", "optional")})</span>
            <input value={f.blNo || ""} onChange={(e) => set("blNo", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_qty", "Quantity")}
            <input type="number" value={f.quantity as any ?? ""} onChange={(e) => set("quantity", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-right" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_weight", "Weight / Cartons")}
            <input type="number" value={f.weightCartons as any ?? ""} onChange={(e) => set("weightCartons", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-right" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("f_unit", "Unit")}
            <select value={f.unit || ""} onChange={(e) => set("unit", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_rate", "Rate")}
            <input type="number" value={f.rate as any ?? ""} onChange={(e) => set("rate", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-right" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_amount", "Amount")}
            <input type="number" value={f.amount as any ?? ""} onChange={(e) => set("amount", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-right font-semibold" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {s.t("col_currency", "Currency")}
            <select value={f.currencyCode || "USD"} onChange={(e) => set("currencyCode", e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
              {CCY.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
            {s.t("col_remarks", "Remarks")}
            <textarea value={f.remarks || ""} onChange={(e) => set("remarks", e.target.value)} rows={2} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">{s.t("cancel", "Cancel")}</button>
          <button onClick={submit} disabled={saving} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60">
            {saving ? s.t("saving", "Saving…") : s.t("save", "Save")}
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {s.t("form_note", "This bill is stored only in the Temporary Bills Register. It does not post to Ledger, Roznamcha, Journal, DR/CR, Stock or any Voucher, and it is not transferred to the main ERP.")}
        </p>
      </div>
    </div>
  );
}
