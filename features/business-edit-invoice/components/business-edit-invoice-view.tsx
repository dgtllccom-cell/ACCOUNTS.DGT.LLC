"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Search, Eye, Printer, X, ShieldCheck } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { printStore } from "@/lib/store/print-store";

type Line = {
  id?: string; sortOrder: number; goodsName?: string | null; description?: string | null; hsCode?: string | null;
  brand?: string | null; size?: string | null; packing?: string | null; packages?: number | null; quantity?: number | null;
  unit?: string | null; netWeight?: number | null; grossWeight?: number | null;
  originalUnitPrice?: number | null; originalAmount?: number | null; documentUnitPrice?: number | null; documentAmount?: number | null;
};
type Invoice = {
  id: string; invoiceNo: string; sourceModule: string; originalBillNo?: string | null; originalManualBillNo?: string | null;
  originalCurrency?: string | null; originalTotalValue?: number | null; docType: string; documentNo?: string | null;
  documentDate?: string | null; documentCurrency?: string | null; documentExchangeRate?: number | null;
  documentTotalValue?: number | null; partyName?: string | null; destination?: string | null; incoterms?: string | null;
  paymentTerms?: string | null; notes?: string | null; validity?: string | null; signatureName?: string | null;
  status: string; versionNo: number; createdAt: string; txnKind: string; branchLabel?: string | null;
  canEdit?: boolean; isManager?: boolean; lines: Line[];
};
type Bill = {
  sourceModule: string; sourceId: string; billNo?: string | null; manualBillNo?: string | null; transactionDate?: string | null;
  branchLabel?: string | null; partyName?: string | null; currency?: string | null; originalBillAmount: number;
  sourceStatus?: string | null; existingInvoiceCount: number;
};
type Screen = ReturnType<typeof useErpScreen>;

const DOC_TYPES = ["commercial_invoice", "proforma_invoice", "export_invoice", "packing_list"] as const;
const MODULES = ["purchase_booking", "sales_booking", "local_purchase", "local_sales"] as const;
const fmt = (n?: number | null) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtD = (d?: string | null) => (d ? String(d).slice(0, 10) : "");

export function BusinessEditInvoiceView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("bei", langProp);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupPending, setSetupPending] = useState(false);
  const [search, setSearch] = useState("");
  const [docFilter, setDocFilter] = useState<string>("all");
  const [showPicker, setShowPicker] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ lang: s.lang });
      if (search.trim()) qs.set("q", search.trim());
      if (docFilter !== "all") qs.set("docType", docFilter);
      const r = await fetch(`/api/erp/business-edit-invoices?${qs.toString()}`);
      const j = await r.json();
      const d = j.data ?? j;
      if (d?.setupPending) { setSetupPending(true); setRows([]); return; }
      setSetupPending(false);
      setRows(d.rows ?? []);
    } finally { setLoading(false); }
  }, [s.lang, search, docFilter]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section dir={s.dir} className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className={s.textStart}>
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-50">{s.t("title", "Business Edit Invoice")}</h1>
          <p className="mt-0.5 max-w-3xl text-xs text-slate-500">{s.t("blurb", "Generate a separate editable business / document invoice from a finalized bill. The original transaction, journal, ledger, roznamcha, stock cost and postings are never changed.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowPicker(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700">
            <Plus className="h-4 w-4" />{s.t("new_from_bill", "New from Bill")}
          </button>
          <button type="button" onClick={() => void load()} aria-label={s.t("loading", "Loading…")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <ShieldCheck className="me-1 inline h-3.5 w-3.5" />{s.t("accounting_note", "The original accounting record (Debit/Credit, Journal, Ledger, Roznamcha, Stock Cost, Payment, Outstanding) is NOT affected by this document.")}
      </div>

      {setupPending ? (
        <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-500 dark:border-slate-800">
          {s.t("setup_pending", "Business Edit Invoice is not set up on this database yet. Run migration 20261023.")}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={s.t("invoice_no", "Invoice No")}
                className="w-56 rounded-lg border border-slate-200 bg-white ps-8 pe-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
            </div>
            <select value={docFilter} onChange={(e) => setDocFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <option value="all">{s.t("doc_type", "Document Type")}</option>
              {DOC_TYPES.map((d) => <option key={d} value={d}>{s.t(d, d)}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className={`p-2 ${s.textStart}`}>{s.t("invoice_no", "Invoice No")}</th>
                  <th className={`p-2 ${s.textStart}`}>{s.t("doc_type", "Document Type")}</th>
                  <th className={`p-2 ${s.textStart}`}>{s.t("source_module", "Source")}</th>
                  <th className={`p-2 ${s.textStart}`}>{s.t("original_bill_no", "Original Bill No")}</th>
                  <th className={`p-2 ${s.textStart}`}>{s.t("party", "Party")}</th>
                  <th className="p-2 text-end">{s.t("original_value", "Original Value")}</th>
                  <th className="p-2 text-end">{s.t("document_value", "Document Value")}</th>
                  <th className={`p-2 ${s.textStart}`}>{s.t("status", "Status")}</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={9} className="p-8 text-center text-slate-400">{s.t("loading", "Loading…")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-slate-400">{s.t("no_invoices", "No business edit invoices yet.")}</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-2 font-bold">{r.invoiceNo}</td>
                    <td className="p-2">{s.t(r.docType, r.docType)}</td>
                    <td className="p-2">{s.t(`m_${r.sourceModule}`, r.sourceModule)}</td>
                    <td className="p-2">{r.originalBillNo || "—"}</td>
                    <td className="p-2">{r.partyName || "—"}</td>
                    <td className="p-2 text-end tabular-nums">{r.originalCurrency} {fmt(r.originalTotalValue)}</td>
                    <td className="p-2 text-end font-bold tabular-nums">{r.documentCurrency} {fmt(r.documentTotalValue)}</td>
                    <td className="p-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase dark:bg-slate-800">{s.t(r.status, r.status)}</span></td>
                    <td className="p-2">
                      <button type="button" onClick={() => setOpenId(r.id)} aria-label={s.t("edit", "Edit")} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold hover:bg-slate-50 dark:border-slate-700">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showPicker && <BillPicker s={s} onClose={() => setShowPicker(false)} onCreated={(id) => { setShowPicker(false); setOpenId(id); void load(); }} />}
      {openId && <InvoiceEditor s={s} id={openId} onClose={() => { setOpenId(null); void load(); }} />}
    </section>
  );
}

/* ── bill picker ─────────────────────────────────────────────────────────── */
function BillPicker({ s, onClose, onCreated }: { s: Screen; onClose: () => void; onCreated: (id: string) => void }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [q, setQ] = useState("");
  const [docType, setDocType] = useState<string>("commercial_invoice");
  const [creating, setCreating] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (moduleFilter !== "all") qs.set("module", moduleFilter);
      if (q.trim()) qs.set("q", q.trim());
      const r = await fetch(`/api/erp/business-edit-invoices/available-bills?${qs.toString()}`);
      const j = await r.json(); const d = j.data ?? j;
      setBills(d.rows ?? []);
    } finally { setLoading(false); }
  }, [moduleFilter, q]);
  useEffect(() => { void load(); }, [load]);

  const create = async (b: Bill) => {
    setCreating(b.sourceId); setErr(null);
    try {
      const r = await fetch("/api/erp/business-edit-invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceModule: b.sourceModule, sourceId: b.sourceId, docType, lang: s.lang }),
      });
      const j = await r.json(); const d = j.data ?? j;
      if (!r.ok || j.error) throw new Error(j?.error?.message || j?.error || "Request failed");
      onCreated(d.id);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setCreating(null); }
  };

  return (
    <Modal s={s} title={s.t("select_bill", "Select the original bill")} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2">
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
          <option value="all">{s.t("source_module", "Source")}</option>
          {MODULES.map((m) => <option key={m} value={m}>{s.t(`m_${m}`, m)}</option>)}
        </select>
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
          {DOC_TYPES.map((d) => <option key={d} value={d}>{s.t(d, d)}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={s.t("original_bill_no", "Original Bill No")}
          className="w-48 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-900" />
      </div>
      {err && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}
      <div className="mt-3 max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-start text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800/70">
            <tr>
              <th className={`p-2 ${s.textStart}`}>{s.t("original_bill_no", "Original Bill No")}</th>
              <th className={`p-2 ${s.textStart}`}>{s.t("source_module", "Source")}</th>
              <th className={`p-2 ${s.textStart}`}>{s.t("branch_company", "Branch / Company")}</th>
              <th className={`p-2 ${s.textStart}`}>{s.t("party", "Party")}</th>
              <th className="p-2 text-end">{s.t("original_value", "Original Value")}</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">{s.t("loading", "Loading…")}</td></tr>
              : bills.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">{s.t("no_bills", "No finalized bills available in your scope.")}</td></tr>
              : bills.map((b) => (
                <tr key={`${b.sourceModule}:${b.sourceId}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="p-2 font-bold">{b.billNo || b.manualBillNo || "—"}<div className="text-[10px] text-slate-400">{fmtD(b.transactionDate)}</div></td>
                  <td className="p-2">{s.t(`m_${b.sourceModule}`, b.sourceModule)}</td>
                  <td className="p-2">{b.branchLabel || "—"}</td>
                  <td className="p-2">{b.partyName || "—"}</td>
                  <td className="p-2 text-end tabular-nums">{b.currency} {fmt(b.originalBillAmount)}</td>
                  <td className="p-2">
                    <button type="button" disabled={creating === b.sourceId} onClick={() => void create(b)}
                      className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                      {creating === b.sourceId ? "…" : s.t("create", "Create Editable Invoice")}
                      {b.existingInvoiceCount > 0 ? ` (${b.existingInvoiceCount})` : ""}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

/* ── invoice editor ─────────────────────────────────────────────────────── */
function InvoiceEditor({ s, id, onClose }: { s: Screen; id: string; onClose: () => void }) {
  const [inv, setInv] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "versions" | "audit">("edit");
  const [versions, setVersions] = useState<Array<{ versionNo: number; documentTotalValue: number | null; changedAt: string; changedByName: string }>>([]);
  const [events, setEvents] = useState<Array<{ type: string; actor: string; at: string }>>([]);

  const load = useCallback(async () => {
    const r = await fetch(`/api/erp/business-edit-invoices/${id}?original=1`);
    const j = await r.json(); const d = j.data ?? j;
    setInv(d.invoice ?? null);
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (tab === "versions") void fetch(`/api/erp/business-edit-invoices/${id}/versions`).then((r) => r.json()).then((j) => setVersions((j.data ?? j).versions ?? []));
    if (tab === "audit") void fetch(`/api/erp/business-edit-invoices/${id}/audit`).then((r) => r.json()).then((j) => setEvents((j.data ?? j).events ?? []));
  }, [tab, id]);

  if (!inv) return <Modal s={s} title={s.t("loading", "Loading…")} onClose={onClose}><div className="p-6 text-sm text-slate-400">{s.t("loading", "Loading…")}</div></Modal>;

  const setH = <K extends keyof Invoice>(k: K, v: Invoice[K]) => setInv((p) => (p ? { ...p, [k]: v } : p));
  const setLine = (i: number, k: keyof Line, v: unknown) => setInv((p) => {
    if (!p) return p;
    const lines = p.lines.map((l, idx) => {
      if (idx !== i) return l;
      const next: Line = { ...l, [k]: v as never };
      if (k === "documentUnitPrice") next.documentAmount = v != null && l.quantity != null ? Number(v) * Number(l.quantity) : l.documentAmount;
      if (k === "quantity") next.documentAmount = l.documentUnitPrice != null && v != null ? Number(l.documentUnitPrice) * Number(v) : next.documentAmount;
      return next;
    });
    const documentTotalValue = lines.reduce((sum, l) => sum + (Number(l.documentAmount) || 0), 0);
    return { ...p, lines, documentTotalValue };
  });

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/erp/business-edit-invoices/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: inv.docType, documentNo: inv.documentNo, documentDate: inv.documentDate || null,
          documentCurrency: inv.documentCurrency, documentTotalValue: inv.documentTotalValue,
          partyName: inv.partyName, destination: inv.destination, incoterms: inv.incoterms,
          paymentTerms: inv.paymentTerms, notes: inv.notes, validity: inv.validity, signatureName: inv.signatureName,
          lines: inv.lines,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j?.error?.message || j?.error || "Save failed");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const preview = async () => {
    setErr(null);
    const r = await fetch(`/api/erp/business-edit-invoices/${id}/document?lang=${s.lang}`);
    const j = await r.json(); const d = j.data ?? j;
    if (d?.html) printStore.openPrint(d.html, d.title || inv.invoiceNo, { lang: s.lang });
    else setErr(j?.error?.message || "Could not render the document.");
  };

  const setStatus = async (status: string) => {
    setErr(null);
    const r = await fetch(`/api/erp/business-edit-invoices/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    const j = await r.json();
    if (!r.ok || j.error) { setErr(j?.error?.message || j?.error || "Request failed"); return; }
    await load();
  };

  const ro = !inv.canEdit;
  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 disabled:opacity-60";

  return (
    <Modal s={s} title={`${inv.invoiceNo} · ${s.t(inv.docType, inv.docType)}`} onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs dark:border-slate-800">
        {(["edit", "versions", "audit"] as const).map((tKey) => (
          <button key={tKey} type="button" onClick={() => setTab(tKey)}
            className={`rounded-lg px-2.5 py-1 font-bold ${tab === tKey ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
            {tKey === "edit" ? s.t("edit", "Edit") : tKey === "versions" ? s.t("version_history", "Version History") : s.t("audit_trail", "Audit Trail")}
          </button>
        ))}
        <div className="ms-auto flex items-center gap-1.5">
          <button type="button" onClick={() => void preview()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-bold hover:bg-slate-50 dark:border-slate-700">
            <Printer className="h-3.5 w-3.5" />{s.t("print_pdf", "Print / PDF")}
          </button>
          {inv.isManager && inv.status !== "finalized" && <button type="button" onClick={() => void setStatus("finalized")} className="rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white">{s.t("finalize", "Finalize")}</button>}
          {inv.isManager && inv.status === "finalized" && <button type="button" onClick={() => void setStatus("draft")} className="rounded-lg border border-amber-300 px-2.5 py-1 font-bold text-amber-700">{s.t("reopen", "Reopen")}</button>}
        </div>
      </div>

      {err && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{err}</p>}

      {tab === "edit" && (
        <div className="space-y-4">
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[11px] dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-3">
            <div><span className="text-slate-400">{s.t("original_bill_no", "Original Bill No")}: </span><b>{inv.originalBillNo || inv.originalManualBillNo || "—"}</b></div>
            <div><span className="text-slate-400">{s.t("original_value", "Original Value")}: </span><b>{inv.originalCurrency} {fmt(inv.originalTotalValue)}</b></div>
            <div><span className="text-slate-400">{s.t("branch_company", "Branch / Company")}: </span><b>{inv.branchLabel || "—"}</b></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[11px] font-bold text-slate-500">{s.t("doc_type", "Document Type")}
              <select disabled={ro} value={inv.docType} onChange={(e) => setH("docType", e.target.value)} className={inputCls}>
                {DOC_TYPES.map((d) => <option key={d} value={d}>{s.t(d, d)}</option>)}
              </select></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("document_no_field", "Document / Invoice No")}
              <input disabled={ro} value={inv.documentNo ?? ""} onChange={(e) => setH("documentNo", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("document_date", "Document Date")}
              <input disabled={ro} type="date" value={fmtD(inv.documentDate)} onChange={(e) => setH("documentDate", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("currency", "Currency")}
              <input disabled={ro} value={inv.documentCurrency ?? ""} onChange={(e) => setH("documentCurrency", e.target.value.toUpperCase())} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{inv.txnKind === "sales" ? s.t("customer", "Customer") : s.t("supplier", "Supplier")}
              <input disabled={ro} value={inv.partyName ?? ""} onChange={(e) => setH("partyName", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("destination", "Destination")}
              <input disabled={ro} value={inv.destination ?? ""} onChange={(e) => setH("destination", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("incoterms", "Incoterms")}
              <input disabled={ro} value={inv.incoterms ?? ""} onChange={(e) => setH("incoterms", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("payment_terms", "Payment Terms")}
              <input disabled={ro} value={inv.paymentTerms ?? ""} onChange={(e) => setH("paymentTerms", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("validity", "Validity")}
              <input disabled={ro} value={inv.validity ?? ""} onChange={(e) => setH("validity", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500">{s.t("signature_name", "Authorized Signatory")}
              <input disabled={ro} value={inv.signatureName ?? ""} onChange={(e) => setH("signatureName", e.target.value)} className={inputCls} /></label>
            <label className="text-[11px] font-bold text-slate-500 sm:col-span-2 lg:col-span-3">{s.t("notes", "Notes")}
              <textarea disabled={ro} value={inv.notes ?? ""} onChange={(e) => setH("notes", e.target.value)} rows={2} className={inputCls} /></label>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-start text-[11px]">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className={`p-1.5 ${s.textStart}`}>{s.t("description", "Description")}</th>
                  <th className={`p-1.5 ${s.textStart}`}>{s.t("hs_code", "HS Code")}</th>
                  <th className="p-1.5 text-end">{s.t("quantity", "Quantity")}</th>
                  <th className={`p-1.5 ${s.textStart}`}>{s.t("unit", "Unit")}</th>
                  <th className="p-1.5 text-end">{s.t("net_weight", "Net Weight")}</th>
                  <th className="p-1.5 text-end">{s.t("original_unit_price", "Original Unit Price")}</th>
                  <th className="p-1.5 text-end">{s.t("document_unit_price", "Document Unit Price")}</th>
                  <th className="p-1.5 text-end">{s.t("amount", "Amount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {inv.lines.map((l, i) => (
                  <tr key={l.id ?? i}>
                    <td className="p-1.5"><input disabled={ro} value={l.description ?? l.goodsName ?? ""} onChange={(e) => setLine(i, "description", e.target.value)} className={inputCls} /></td>
                    <td className="p-1.5"><input disabled={ro} value={l.hsCode ?? ""} onChange={(e) => setLine(i, "hsCode", e.target.value)} className={`${inputCls} w-24`} /></td>
                    <td className="p-1.5 text-end"><input disabled={ro} type="number" value={l.quantity ?? ""} onChange={(e) => setLine(i, "quantity", e.target.value === "" ? null : Number(e.target.value))} className={`${inputCls} w-20 text-end`} /></td>
                    <td className="p-1.5"><input disabled={ro} value={l.unit ?? ""} onChange={(e) => setLine(i, "unit", e.target.value)} className={`${inputCls} w-16`} /></td>
                    <td className="p-1.5 text-end"><input disabled={ro} type="number" value={l.netWeight ?? ""} onChange={(e) => setLine(i, "netWeight", e.target.value === "" ? null : Number(e.target.value))} className={`${inputCls} w-24 text-end`} /></td>
                    <td className="p-1.5 text-end tabular-nums text-slate-400">{fmt(l.originalUnitPrice)}</td>
                    <td className="p-1.5 text-end"><input disabled={ro} type="number" value={l.documentUnitPrice ?? ""} onChange={(e) => setLine(i, "documentUnitPrice", e.target.value === "" ? null : Number(e.target.value))} className={`${inputCls} w-24 text-end font-bold`} /></td>
                    <td className="p-1.5 text-end font-bold tabular-nums">{fmt(l.documentAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-700">
                  <td colSpan={7} className="p-1.5 text-end font-bold">{s.t("document_value", "Document Value")}</td>
                  <td className="p-1.5 text-end font-black tabular-nums">{inv.documentCurrency} {fmt(inv.documentTotalValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {!ro && (
            <div className="flex justify-end">
              <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl !bg-blue-600 px-5 py-2 text-xs font-bold !text-white hover:!bg-blue-700 disabled:opacity-60">
                {saving ? "…" : s.t("save", "Save")}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "versions" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50"><tr>
              <th className={`p-2 ${s.textStart}`}>{s.t("version", "Version")}</th>
              <th className="p-2 text-end">{s.t("document_value", "Document Value")}</th>
              <th className={`p-2 ${s.textStart}`}>{s.t("created_by", "Created By")}</th>
              <th className={`p-2 ${s.textStart}`}>{s.t("created_at", "Date / Time")}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {versions.map((v) => (
                <tr key={v.versionNo}><td className="p-2 font-bold">v{v.versionNo}</td>
                  <td className="p-2 text-end tabular-nums">{fmt(v.documentTotalValue)}</td>
                  <td className="p-2">{v.changedByName}</td>
                  <td className="p-2">{new Date(v.changedAt).toLocaleString()}</td></tr>
              ))}
              {versions.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">—</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {tab === "audit" && (
        <ul className="space-y-1.5 text-xs">
          {events.map((e, i) => (
            <li key={i} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
              <b className="uppercase">{e.type}</b> · {e.actor} · {new Date(e.at).toLocaleString()}
            </li>
          ))}
          {events.length === 0 && <li className="p-6 text-center text-slate-400">—</li>}
        </ul>
      )}
    </Modal>
  );
}

function Modal({ s, title, onClose, children, wide }: { s: Screen; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div dir={s.dir} className={`w-full ${wide ? "max-w-5xl" : "max-w-lg"} rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-950`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-50">{title}</h2>
          <button type="button" onClick={onClose} aria-label={s.t("edit", "Edit")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
