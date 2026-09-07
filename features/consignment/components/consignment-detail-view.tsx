"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { t } from "@/lib/i18n/ui";
import { localizeUom } from "@/lib/i18n/uom";
import {
  fetchConsignmentReport,
  addEntryReq,
  deleteEntryReq,
  updateEntryReq,
  updateConsignmentReq,
  transferConsignmentReq,
  untransferConsignmentReq,
} from "@/features/consignment/consignment-api";
import type { ConsignmentReport } from "@/lib/consignment/types";
import {
  CONSIGNMENT_STATUSES,
  CONTAINER_STATUSES,
  EXPENSE_TYPES,
  RECEIPT_METHODS,
} from "@/lib/consignment/types";
import { openConsignmentReport } from "@/features/consignment/consignment-report";
import { MasterCombo } from "@/features/consignment/components/master-combo";
import { HeadEditModal, EditRowModal } from "@/features/consignment/components/consignment-edit-modals";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function ConsignmentDetailView({ id, lang: langProp }: { id: string; lang?: string }) {
  const s = useErpScreen("cns", langProp);
  const { lang, dir } = s;
  const [report, setReport] = useState<ConsignmentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchConsignmentReport(id);
      setReport(data.report);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const ccy = report?.consignment.base_currency || "USD";
  const money = useCallback(
    (n: number) => `${ccy} ${num(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    [ccy],
  );

  const [editRow, setEditRow] = useState<{ kind: string; row: any } | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);

  async function addEntry(payload: Record<string, unknown>) {
    setBusyKind(String(payload.kind));
    try {
      await addEntryReq(id, payload);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKind(null);
    }
  }

  async function saveEditRow(kind: string, childId: string, patch: Record<string, unknown>) {
    try {
      await updateEntryReq(id, kind, childId, patch);
      setEditRow(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function removeEntry(kind: string, childId: string) {
    if (!confirm(t(lang, "cns.confirm_delete", "Delete this entry?"))) return;
    try {
      await deleteEntryReq(id, kind, childId);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function doTransfer(reverse: boolean) {
    const msg = reverse
      ? t(lang, "cns.confirm_untransfer", "Reverse the transfer and unlock this consignment for editing?")
      : t(lang, "cns.confirm_transfer", "Transfer / Confirm this consignment to Main ERP? It will be locked from further editing. This does NOT post any ledger/roznamcha entry — it only marks it confirmed.");
    if (!confirm(msg)) return;
    setTransferBusy(true);
    try {
      if (reverse) await untransferConsignmentReq(id);
      else await transferConsignmentReq(id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setTransferBusy(false);
    }
  }

  const containerOptions = useMemo(
    () => (report?.containers || []).map((c) => ({ id: c.id, label: c.container_no || c.bl_no || c.id.slice(0, 8) })),
    [report],
  );

  if (loading) return <p className="mx-auto max-w-6xl px-4 py-10 text-center text-muted-foreground">{s.t("loading", "Loading…")}</p>;
  if (err || !report)
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-center">
        <p className="text-sm text-red-600">{err || s.t("error", "Could not load the Consignment Register.")}</p>
        <Link href="/dashboard/consignment" className="mt-3 inline-block text-sm font-bold text-primary hover:underline">
          {s.t("back_to_register", "← Back to Register")}
        </Link>
      </div>
    );

  const c = report.consignment;
  const T = report.totals;
  const locked = c.accounting_status === "transferred";

  return (
    <section dir={dir} className="mx-auto max-w-6xl px-4 py-4 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/consignment" className="text-xs font-bold text-primary hover:underline">
            {s.t("back_to_register", "← Back to Register")}
          </Link>
          <h1 className="mt-1 text-xl font-black text-foreground">
            <span className="font-mono">{c.consignment_no}</span> · {c.party_name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {c.title && <span>{c.title} · </span>}
            {c.reference_no && <span>{s.t("reference_no", "Reference No")}: {c.reference_no} · </span>}
            {c.tender_no && <span>{s.t("tender_no", "Tender / Contract No")}: {c.tender_no} · </span>}
            {(c.loading_from_date || c.loading_to_date) && (
              <span>{s.t("loading_window", "Loading")}: {String(c.loading_from_date || "—").slice(0, 10)} → {String(c.loading_to_date || "—").slice(0, 10)}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditRow({ kind: "head", row: c })}
            disabled={locked}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {s.t("edit_details", "Edit Details")}
          </button>
          <select
            value={c.status}
            disabled={locked}
            onChange={async (e) => {
              try {
                await updateConsignmentReq(id, { status: e.target.value });
                await load();
              } catch (er) {
                alert(er instanceof Error ? er.message : String(er));
              }
            }}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm disabled:opacity-50"
          >
            {CONSIGNMENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {s.t(`status_${st}`, st)}
              </option>
            ))}
          </select>
          {locked ? (
            <button
              type="button"
              onClick={() => doTransfer(true)}
              disabled={transferBusy}
              className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-bold text-amber-600 hover:bg-amber-500/10 disabled:opacity-60"
            >
              {s.t("reverse_transfer", "Reverse Transfer")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => doTransfer(false)}
              disabled={transferBusy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              {s.t("transfer_to_erp", "Transfer / Confirm to Main ERP")}
            </button>
          )}
          <button
            type="button"
            onClick={() => openConsignmentReport(report, lang)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            {s.t("print", "Print / PDF")}
          </button>
        </div>
      </div>

      {locked ? (
        <div className="rounded-lg border border-emerald-400/50 bg-emerald-50 px-3 py-2 text-[11px] leading-snug text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {s.t("locked_note", "Transferred to Main ERP on")} {c.transferred_at ? new Date(c.transferred_at).toLocaleString() : ""} — {s.t("locked_note_2", "this register row is locked. Reverse the transfer to edit again.")}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {s.t("tracking_note", "Tracking only — container, expense, sale and receipt entries here do NOT post to Purchase, Sales, Ledger, Journal or Roznamcha until you press Transfer / Confirm to Main ERP.")}
        </div>
      )}

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label={s.t("col_containers", "Containers")} value={String(T.containerCount)} />
        <Kpi label={s.t("total_cartons", "Total Cartons")} value={num(T.totalCartons).toLocaleString()} />
        <Kpi label={s.t("remaining_cartons", "Remaining Cartons")} value={num(T.remainingCartons).toLocaleString()} accent="blue" />
        <Kpi label={s.t("total_received_qty", "Total Qty / Weight Received")} value={num(T.goodsReceivedQty).toLocaleString()} />
        <Kpi label={s.t("remaining_stock", "Remaining Qty")} value={num(T.remainingStockQty).toLocaleString()} accent="blue" />
        <Kpi label={s.t("reference_value", "Reference Value")} value={money(T.referenceValue)} />
        <Kpi label={s.t("total_sales", "Total Sales Value")} value={money(T.totalSales)} accent="emerald" />
        <Kpi label={s.t("total_expenses", "Total Expenses")} value={money(T.totalExpenses)} accent="amber" />
        <Kpi label={s.t("net_receivable", "Net Receivable")} value={money(T.netReceivable)} />
        <Kpi label={s.t("amount_received", "Amount Received")} value={money(T.amountReceived)} accent="emerald" />
        <Kpi label={s.t("balance_receivable", "Balance Receivable")} value={money(T.balanceReceivable)} accent="red" />
      </div>

      {/* Stock position */}
      <Panel title={s.t("stock_position", "Remaining Stock Position")}>
        <SimpleTable
          dir={dir}
          head={[s.t("goods_name", "Goods Name"), s.t("unit", "Unit"), s.t("received", "Received"), s.t("sold", "Sold"), s.t("remaining", "Remaining")]}
          rows={report.stockByGoods.map((g) => [
            g.goodsName,
            g.unit ? localizeUom(lang, g.unit) : "—",
            num(g.received).toLocaleString(),
            num(g.sold).toLocaleString(),
            num(g.remaining).toLocaleString(),
          ])}
          empty={s.t("empty_children", "Nothing added yet.")}
        />
      </Panel>

      {/* Containers + goods */}
      <Panel
        title={s.t("containers", "Containers")}
        action={
          !locked && <ContainerForm lang={lang} busy={busyKind === "container"} onAdd={(p) => addEntry({ kind: "container", ...p })} />
        }
      >
        {report.containers.length === 0 ? (
          <Empty text={s.t("empty_children", "Nothing added yet.")} />
        ) : (
          <div className="space-y-3">
            {report.containers.map((ct) => (
              <div key={ct.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-mono font-bold">{ct.container_no || "—"}</span>
                    {ct.bl_no && <span className="ms-2 text-muted-foreground">BL: {ct.bl_no}</span>}
                    {ct.loading_date && <span className="ms-2 text-muted-foreground">{s.t("loading_date", "Loading Date")}: {String(ct.loading_date).slice(0, 10)}</span>}
                    {ct.reference_value != null && <span className="ms-2 text-muted-foreground">{s.t("reference_value", "Reference Value")}: {num(ct.reference_value).toLocaleString()}</span>}
                    <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs">{s.t(`cs_${ct.status}`, ct.status)}</span>
                    <span
                      className={`ms-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                        ct.sale_status === "sold"
                          ? "bg-emerald-500/15 text-emerald-600"
                          : ct.sale_status === "partial"
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-slate-500/15 text-slate-500"
                      }`}
                    >
                      {s.t(`ss_${ct.sale_status}`, ct.sale_status)}
                    </span>
                  </div>
                  {!locked && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setEditRow({ kind: "container", row: ct })} className="text-xs text-primary hover:underline">
                        {s.t("edit", "Edit")}
                      </button>
                      <button type="button" onClick={() => removeEntry("container", ct.id)} className="text-xs text-red-600 hover:underline">
                        {s.t("delete", "Delete")}
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <SimpleTable
                    dir={dir}
                    dense
                    head={[s.t("goods_name", "Goods Name"), s.t("cartons", "Cartons"), s.t("quantity", "Quantity"), s.t("unit", "Unit"), s.t("net_weight", "Net Weight"), s.t("rate", "Rate"), s.t("amount", "Amount"), ""]}
                    rows={ct.goods.map((g) => [
                      g.goods_name,
                      g.cartons != null ? String(g.cartons) : "—",
                      num(g.quantity).toLocaleString(),
                      g.unit_label ? localizeUom(lang, g.unit_label) : "—",
                      g.net_weight != null ? String(g.net_weight) : "—",
                      g.rate != null ? String(g.rate) : "—",
                      g.amount != null ? num(g.amount).toLocaleString() : "—",
                      locked ? "" : (
                        <span key="a" className="flex gap-2">
                          <button type="button" onClick={() => setEditRow({ kind: "good", row: g })} className="text-xs text-primary hover:underline">
                            {s.t("edit", "Edit")}
                          </button>
                          <button type="button" onClick={() => removeEntry("good", g.id)} className="text-xs text-red-600 hover:underline">
                            {s.t("delete", "Delete")}
                          </button>
                        </span>
                      ),
                    ])}
                    empty={s.t("empty_children", "Nothing added yet.")}
                  />
                  {!locked && (
                    <GoodForm
                      lang={lang}
                      busy={busyKind === "good"}
                      onAdd={(p) => addEntry({ kind: "good", container_id: ct.id, ...p })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Expenses */}
      <Panel
        title={s.t("expenses", "Expenses")}
        action={
          !locked && (
            <ExpenseForm
              lang={lang}
              containers={containerOptions}
              busy={busyKind === "expense"}
              onAdd={(p) => addEntry({ kind: "expense", ...p })}
            />
          )
        }
      >
        <SimpleTable
          dir={dir}
          head={[s.t("expense_date", "Expense Date"), s.t("expense_type", "Expense Type"), s.t("description", "Description"), s.t("currency", "Currency"), s.t("amount", "Amount"), ""]}
          rows={report.expenses.map((e) => [
            String(e.expense_date).slice(0, 10),
            s.t(`et_${e.expense_type}`, e.expense_type),
            e.description || "—",
            e.currency,
            num(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
            <RowActions key="a" locked={locked} onEdit={() => setEditRow({ kind: "expense", row: e })} onDelete={() => removeEntry("expense", e.id)} t={s.t} />,
          ])}
          empty={s.t("empty_children", "Nothing added yet.")}
        />
      </Panel>

      {/* Sales */}
      <Panel
        title={s.t("sales", "Sales")}
        action={
          !locked && (
            <SaleForm
              lang={lang}
              containers={containerOptions}
              busy={busyKind === "sale"}
              onAdd={(p) => addEntry({ kind: "sale", ...p })}
            />
          )
        }
      >
        <SimpleTable
          dir={dir}
          head={[s.t("sale_date", "Sale Date"), s.t("buyer_name", "Buyer / Customer"), s.t("goods_name", "Goods Name"), s.t("cartons", "Cartons"), s.t("quantity", "Qty / Weight"), s.t("rate", "Rate"), s.t("amount", "Amount"), ""]}
          rows={report.sales.map((sl) => [
            String(sl.sale_date).slice(0, 10),
            sl.buyer_name || "—",
            sl.goods_name,
            sl.cartons != null ? String(sl.cartons) : "—",
            `${num(sl.quantity).toLocaleString()}${sl.net_weight != null ? ` / ${num(sl.net_weight).toLocaleString()}` : ""}`,
            sl.rate != null ? String(sl.rate) : "—",
            `${sl.currency} ${num(sl.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            <RowActions key="a" locked={locked} onEdit={() => setEditRow({ kind: "sale", row: sl })} onDelete={() => removeEntry("sale", sl.id)} t={s.t} />,
          ])}
          empty={s.t("empty_children", "Nothing added yet.")}
        />
      </Panel>

      {/* Receipts */}
      <Panel
        title={s.t("receipts", "Receipts / Collections")}
        action={!locked && <ReceiptForm lang={lang} busy={busyKind === "receipt"} onAdd={(p) => addEntry({ kind: "receipt", ...p })} />}
      >
        <SimpleTable
          dir={dir}
          head={[s.t("receipt_date", "Receipt Date"), s.t("method", "Method"), s.t("currency", "Currency"), s.t("amount", "Amount"), ""]}
          rows={report.receipts.map((r) => [
            String(r.receipt_date).slice(0, 10),
            s.t(`m_${r.method}`, r.method),
            r.currency,
            num(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }),
            <RowActions key="a" locked={locked} onEdit={() => setEditRow({ kind: "receipt", row: r })} onDelete={() => removeEntry("receipt", r.id)} t={s.t} />,
          ])}
          empty={s.t("empty_children", "Nothing added yet.")}
        />
      </Panel>

      {/* History */}
      <Panel title={s.t("history", "History / Audit Trail")}>
        <SimpleTable
          dir={dir}
          dense
          head={[s.t("datetime", "Date / Time"), s.t("event", "Event"), s.t("event_detail", "Detail"), s.t("actor", "User")]}
          rows={report.events.map((ev) => [
            new Date(ev.created_at).toLocaleString(),
            s.t(`ev_${ev.event_type}`, ev.event_type),
            ev.detail || "—",
            ev.actor_name || "—",
          ])}
          empty={s.t("empty_children", "Nothing added yet.")}
        />
      </Panel>

      {editRow?.kind === "head" && (
        <HeadEditModal
          lang={lang}
          isRtl={dir === "rtl"}
          row={editRow.row}
          onClose={() => setEditRow(null)}
          onSaved={async (patch) => {
            try {
              await updateConsignmentReq(id, patch);
              setEditRow(null);
              await load();
            } catch (e) {
              alert(e instanceof Error ? e.message : String(e));
            }
          }}
        />
      )}
      {editRow && editRow.kind !== "head" && (
        <EditRowModal
          lang={lang}
          isRtl={dir === "rtl"}
          kind={editRow.kind}
          row={editRow.row}
          containers={containerOptions}
          onClose={() => setEditRow(null)}
          onSave={(patch) => saveEditRow(editRow.kind, editRow.row.id, patch)}
        />
      )}
    </section>
  );
}

function RowActions({ locked, onEdit, onDelete, t: tr }: { locked: boolean; onEdit: () => void; onDelete: () => void; t: (k: string, f: string) => string }) {
  if (locked) return <span />;
  return (
    <span className="flex gap-2">
      <button type="button" onClick={onEdit} className="text-xs text-primary hover:underline">
        {tr("edit", "Edit")}
      </button>
      <button type="button" onClick={onDelete} className="text-xs text-red-600 hover:underline">
        {tr("delete", "Delete")}
      </button>
    </span>
  );
}

/* ---------- small presentational helpers ---------- */

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "blue" | "emerald" | "amber" | "red" }) {
  const bar =
    accent === "emerald"
      ? "border-s-emerald-500"
      : accent === "amber"
      ? "border-s-amber-500"
      : accent === "red"
      ? "border-s-red-500"
      : accent === "blue"
      ? "border-s-blue-500"
      : "border-s-slate-400";
  return (
    <div className={`rounded-lg border border-border bg-card px-3 py-2 border-s-4 ${bar}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-black text-foreground">{value}</div>
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-black uppercase tracking-wide text-foreground">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{text}</p>;
}

function SimpleTable({
  head,
  rows,
  empty,
  dir,
  dense,
}: {
  head: React.ReactNode[];
  rows: React.ReactNode[][];
  empty: string;
  dir: "rtl" | "ltr";
  dense?: boolean;
}) {
  const start = dir === "rtl" ? "text-right" : "text-left";
  return (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-[560px] ${dense ? "text-xs" : "text-sm"}`}>
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={`px-2.5 py-1.5 ${start}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="px-2.5 py-5 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((cell, j) => (
                  <td key={j} className={`px-2.5 py-1.5 ${start}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- inline add-entry forms ---------- */

const inputCls =
  "h-8 rounded-md border border-border bg-background px-2 text-xs outline-none";

function ContainerForm({ lang, onAdd, busy }: { lang: string; onAdd: (p: Record<string, unknown>) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const blank = { container_no: "", bl_no: "", loading_date: "", total_cartons: "", total_net_weight: "", reference_rate: "", reference_value: "", status: "received" };
  const [f, setF] = useState(blank);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
        + {t(lang, "cns.add_container", "Add Container")}
      </button>
    );
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <input placeholder={t(lang, "cns.container_no", "Container No")} value={f.container_no} onChange={(e) => set("container_no", e.target.value)} className={inputCls} />
      <input placeholder={t(lang, "cns.bl_no", "BL No")} value={f.bl_no} onChange={(e) => set("bl_no", e.target.value)} className={inputCls} />
      <input type="date" value={f.loading_date} onChange={(e) => set("loading_date", e.target.value)} className={inputCls} />
      <input type="number" placeholder={t(lang, "cns.cartons", "Carton Qty")} value={f.total_cartons} onChange={(e) => set("total_cartons", e.target.value)} className={`${inputCls} w-24`} />
      <input type="number" placeholder={t(lang, "cns.net_weight", "Weight")} value={f.total_net_weight} onChange={(e) => set("total_net_weight", e.target.value)} className={`${inputCls} w-24`} />
      <input type="number" placeholder={t(lang, "cns.reference_rate", "Reference Rate")} value={f.reference_rate} onChange={(e) => set("reference_rate", e.target.value)} className={`${inputCls} w-28`} />
      <input type="number" placeholder={t(lang, "cns.reference_value", "Reference Value")} value={f.reference_value} onChange={(e) => set("reference_value", e.target.value)} className={`${inputCls} w-28`} />
      <select value={f.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
        {CONTAINER_STATUSES.map((st) => (
          <option key={st} value={st}>
            {t(lang, `cns.cs_${st}`, st)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          onAdd(f);
          setF(blank);
          setOpen(false);
        }}
        className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-60"
      >
        {t(lang, "cns.save", "Save")}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground">
        {t(lang, "cns.cancel", "Cancel")}
      </button>
    </div>
  );
}

function GoodForm({ lang, onAdd, busy }: { lang: string; onAdd: (p: Record<string, unknown>) => void; busy: boolean }) {
  const blank = { goods_id: null as string | null, goods_name: "", cartons: "", quantity: "", unit_label: "", net_weight: "", rate: "", amount: "", currency: "USD" };
  const [f, setF] = useState(blank);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-dashed border-border pt-2">
      <div className="min-w-[160px]">
        <MasterCombo source="goods" lang={lang} value={f.goods_name} linkedId={f.goods_id} onChange={(name, linkedId) => setF((p) => ({ ...p, goods_name: name, goods_id: linkedId }))} placeholder={t(lang, "cns.goods_name", "Goods Name (from Goods Master)")} />
      </div>
      <input type="number" placeholder={t(lang, "cns.cartons", "Cartons")} value={f.cartons} onChange={(e) => set("cartons", e.target.value)} className={`${inputCls} w-20`} />
      <input type="number" placeholder={t(lang, "cns.quantity", "Quantity")} value={f.quantity} onChange={(e) => set("quantity", e.target.value)} className={`${inputCls} w-24`} />
      <input placeholder={t(lang, "cns.unit", "Unit")} value={f.unit_label} onChange={(e) => set("unit_label", e.target.value)} className={`${inputCls} w-20`} />
      <input type="number" placeholder={t(lang, "cns.net_weight", "Net Weight")} value={f.net_weight} onChange={(e) => set("net_weight", e.target.value)} className={`${inputCls} w-24`} />
      <input type="number" placeholder={t(lang, "cns.reference_rate", "Reference Rate")} value={f.rate} onChange={(e) => set("rate", e.target.value)} className={`${inputCls} w-24`} />
      <input type="number" placeholder={t(lang, "cns.reference_value", "Reference Value")} value={f.amount} onChange={(e) => set("amount", e.target.value)} className={`${inputCls} w-24`} />
      <input placeholder={t(lang, "cns.currency", "Currency")} value={f.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} className={`${inputCls} w-16`} />
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (!f.goods_name.trim()) return;
          onAdd(f);
          setF(blank);
        }}
        className="rounded-md bg-primary/90 px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-60"
      >
        + {t(lang, "cns.add_good", "Add Goods Line")}
      </button>
    </div>
  );
}

function ExpenseForm({
  lang,
  containers,
  onAdd,
  busy,
}: {
  lang: string;
  containers: { id: string; label: string }[];
  onAdd: (p: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ expense_type: "customs", description: "", currency: "USD", amount: "", expense_date: new Date().toISOString().slice(0, 10), container_id: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
        + {t(lang, "cns.add_expense", "Add Expense")}
      </button>
    );
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <select value={f.expense_type} onChange={(e) => set("expense_type", e.target.value)} className={inputCls}>
        {EXPENSE_TYPES.map((et) => (
          <option key={et} value={et}>
            {t(lang, `cns.et_${et}`, et)}
          </option>
        ))}
      </select>
      <input placeholder={t(lang, "cns.description", "Description")} value={f.description} onChange={(e) => set("description", e.target.value)} className={`${inputCls} min-w-[120px]`} />
      <input type="date" value={f.expense_date} onChange={(e) => set("expense_date", e.target.value)} className={inputCls} />
      <input placeholder={t(lang, "cns.currency", "Currency")} value={f.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} className={`${inputCls} w-16`} />
      <input type="number" placeholder={t(lang, "cns.amount", "Amount")} value={f.amount} onChange={(e) => set("amount", e.target.value)} className={`${inputCls} w-24`} />
      {containers.length > 0 && (
        <select value={f.container_id} onChange={(e) => set("container_id", e.target.value)} className={inputCls}>
          <option value="">{t(lang, "cns.containers", "Containers")}</option>
          {containers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          onAdd({ ...f, container_id: f.container_id || null });
          setF({ expense_type: "freight", description: "", currency: "USD", amount: "", expense_date: new Date().toISOString().slice(0, 10), container_id: "" });
          setOpen(false);
        }}
        className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-60"
      >
        {t(lang, "cns.save", "Save")}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground">
        {t(lang, "cns.cancel", "Cancel")}
      </button>
    </div>
  );
}

function SaleForm({
  lang,
  containers,
  onAdd,
  busy,
}: {
  lang: string;
  containers: { id: string; label: string }[];
  onAdd: (p: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const blank = { sale_date: new Date().toISOString().slice(0, 10), buyer_name: "", buyer_customer_id: null as string | null, goods_id: null as string | null, goods_name: "", cartons: "", quantity: "", net_weight: "", unit_label: "", rate: "", currency: "USD", amount: "", container_id: "" };
  const [f, setF] = useState(blank);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
        + {t(lang, "cns.add_sale", "Add Sale")}
      </button>
    );
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <input type="date" value={f.sale_date} onChange={(e) => set("sale_date", e.target.value)} className={inputCls} />
      <div className="min-w-[150px]">
        <MasterCombo source="customer" lang={lang} value={f.buyer_name} linkedId={f.buyer_customer_id} onChange={(name, linkedId) => setF((p) => ({ ...p, buyer_name: name, buyer_customer_id: linkedId }))} placeholder={t(lang, "cns.buyer_name", "Buyer / Customer")} />
      </div>
      <div className="min-w-[150px]">
        <MasterCombo source="goods" lang={lang} value={f.goods_name} linkedId={f.goods_id} onChange={(name, linkedId) => setF((p) => ({ ...p, goods_name: name, goods_id: linkedId }))} placeholder={t(lang, "cns.goods_name", "Goods Name")} />
      </div>
      <input type="number" placeholder={t(lang, "cns.cartons", "Cartons")} value={f.cartons} onChange={(e) => set("cartons", e.target.value)} className={`${inputCls} w-20`} />
      <input type="number" placeholder={t(lang, "cns.quantity", "Quantity")} value={f.quantity} onChange={(e) => set("quantity", e.target.value)} className={`${inputCls} w-20`} />
      <input type="number" placeholder={t(lang, "cns.net_weight", "Weight")} value={f.net_weight} onChange={(e) => set("net_weight", e.target.value)} className={`${inputCls} w-20`} />
      <input placeholder={t(lang, "cns.unit", "Unit")} value={f.unit_label} onChange={(e) => set("unit_label", e.target.value)} className={`${inputCls} w-16`} />
      <input type="number" placeholder={t(lang, "cns.rate", "Rate")} value={f.rate} onChange={(e) => set("rate", e.target.value)} className={`${inputCls} w-20`} />
      <input placeholder={t(lang, "cns.currency", "Currency")} value={f.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} className={`${inputCls} w-16`} />
      <input type="number" placeholder={t(lang, "cns.amount", "Amount")} value={f.amount} onChange={(e) => set("amount", e.target.value)} className={`${inputCls} w-24`} />
      {containers.length > 0 && (
        <select value={f.container_id} onChange={(e) => set("container_id", e.target.value)} className={inputCls}>
          <option value="">{t(lang, "cns.containers", "Container")}</option>
          {containers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (!f.goods_name.trim()) return;
          onAdd({ ...f, container_id: f.container_id || null, buyer_customer_id: f.buyer_customer_id || null, goods_id: f.goods_id || null });
          setF(blank);
          setOpen(false);
        }}
        className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-60"
      >
        {t(lang, "cns.save", "Save")}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground">
        {t(lang, "cns.cancel", "Cancel")}
      </button>
    </div>
  );
}

function ReceiptForm({ lang, onAdd, busy }: { lang: string; onAdd: (p: Record<string, unknown>) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ receipt_date: new Date().toISOString().slice(0, 10), method: "cash", currency: "USD", amount: "", reference_no: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-md bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
        + {t(lang, "cns.add_receipt", "Add Receipt")}
      </button>
    );
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <input type="date" value={f.receipt_date} onChange={(e) => set("receipt_date", e.target.value)} className={inputCls} />
      <select value={f.method} onChange={(e) => set("method", e.target.value)} className={inputCls}>
        {RECEIPT_METHODS.map((m) => (
          <option key={m} value={m}>
            {t(lang, `cns.m_${m}`, m)}
          </option>
        ))}
      </select>
      <input placeholder={t(lang, "cns.currency", "Currency")} value={f.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} className={`${inputCls} w-16`} />
      <input type="number" placeholder={t(lang, "cns.amount", "Amount")} value={f.amount} onChange={(e) => set("amount", e.target.value)} className={`${inputCls} w-24`} />
      <input placeholder={t(lang, "cns.reference_no", "Reference No")} value={f.reference_no} onChange={(e) => set("reference_no", e.target.value)} className={`${inputCls} w-28`} />
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          onAdd(f);
          setF({ receipt_date: new Date().toISOString().slice(0, 10), method: "cash", currency: "USD", amount: "", reference_no: "" });
          setOpen(false);
        }}
        className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-60"
      >
        {t(lang, "cns.save", "Save")}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground">
        {t(lang, "cns.cancel", "Cancel")}
      </button>
    </div>
  );
}
