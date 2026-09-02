"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { t } from "@/lib/i18n/ui";
import {
  fetchConsignments,
  createConsignmentReq,
  type ConsignmentListRow,
} from "@/features/consignment/consignment-api";
import { CONSIGNMENT_STATUSES } from "@/lib/consignment/types";

const CCY = ["USD", "AED", "PKR", "AFN", "EUR", "GBP", "INR", "CNY", "SAR", "IRR"];

function statusKey(s: string) {
  return `status_${s}`;
}

export function ConsignmentRegisterView({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("cns", langProp);
  const { lang, isRtl, dir } = s;

  const [rows, setRows] = useState<ConsignmentListRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [setupPending, setSetupPending] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await fetchConsignments({ q, status });
      setRows(data.rows || []);
      setSummary(data.summary || {});
      setSetupPending(Boolean(data.setupPending));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const money = useMemo(
    () => (n: number, ccy = "USD") =>
      `${ccy} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    [],
  );

  return (
    <section dir={dir} className="mx-auto max-w-7xl px-4 py-4 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-foreground">{s.t("title", "Consignment Stock & Sales Register")}</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{s.t("subtitle", "Track received containers, expenses, sales and collections per Party — tracking only, no accounting posting")}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90"
        >
          + {s.t("new", "New Consignment")}
        </button>
      </header>

      <div className="rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
        {s.t("tracking_note", "Tracking only — container, expense, sale and receipt entries here do NOT post to Purchase, Sales, Ledger, Journal or Roznamcha. Transfer to Accounting is a later phase.")}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryCard label={s.t("summary_total", "Total Consignments")} value={summary.total ?? 0} />
        <SummaryCard label={s.t("summary_active", "Active")} value={summary.active ?? 0} accent="emerald" />
        <SummaryCard label={s.t("summary_done", "Completed / Closed")} value={summary.done ?? 0} accent="slate" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={s.t("search_ph", "Search consignment no, party, title…")}
          className={`h-9 min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none ${s.textStart}`}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm outline-none"
        >
          <option value="">{s.t("all_status", "All Statuses")}</option>
          {CONSIGNMENT_STATUSES.map((st) => (
            <option key={st} value={st}>
              {s.t(statusKey(st), st)}
            </option>
          ))}
        </select>
      </div>

      {setupPending && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {s.t("setup_pending", "Consignment Register is not set up on this database yet.")}
        </p>
      )}
      {err && !setupPending && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-6 text-center text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {err}
        </p>
      )}

      {!setupPending && !err && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_no", "Consignment No")}</th>
                <th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_party", "Party / Account")}</th>
                <th className={`px-3 py-2 ${s.textStart}`}>{s.t("col_date", "Date")}</th>
                <th className="px-3 py-2 text-center">{s.t("col_containers", "Containers")}</th>
                <th className={`px-3 py-2 ${s.textEnd}`}>{s.t("col_sales", "Sales")}</th>
                <th className={`px-3 py-2 ${s.textEnd}`}>{s.t("col_receipts", "Receipts")}</th>
                <th className={`px-3 py-2 ${s.textEnd}`}>{s.t("col_receivable", "Receivable")}</th>
                <th className="px-3 py-2 text-center">{s.t("col_status", "Status")}</th>
                <th className="px-3 py-2 text-center">{s.t("col_actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    {s.t("loading", "Loading…")}
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    {s.t("empty", "No consignments yet. Create the first one to start tracking.")}
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => {
                  const receivable = Number(r.total_sales || 0) - Number(r.total_receipts || 0);
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className={`px-3 py-2 font-mono font-semibold ${s.textStart}`}>{r.consignment_no}</td>
                      <td className={`px-3 py-2 ${s.textStart}`}>
                        <div className="font-semibold text-foreground">{r.party_name}</div>
                        {r.title && <div className="text-xs text-muted-foreground">{r.title}</div>}
                      </td>
                      <td className={`px-3 py-2 ${s.textStart}`}>{String(r.consignment_date || "").slice(0, 10)}</td>
                      <td className="px-3 py-2 text-center">{r.container_count ?? 0}</td>
                      <td className={`px-3 py-2 font-mono ${s.textEnd}`}>{money(r.total_sales, r.base_currency)}</td>
                      <td className={`px-3 py-2 font-mono ${s.textEnd}`}>{money(r.total_receipts, r.base_currency)}</td>
                      <td className={`px-3 py-2 font-mono font-semibold ${s.textEnd} ${receivable > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        {money(receivable, r.base_currency)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                          {s.t(statusKey(r.status), r.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Link href={`/dashboard/consignment/${r.id}`} className="text-xs font-bold text-primary hover:underline">
                          {s.t("view", "View")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateConsignmentModal
          lang={lang}
          isRtl={isRtl}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </section>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "slate" }) {
  const bar = accent === "emerald" ? "border-s-emerald-500" : accent === "slate" ? "border-s-slate-500" : "border-s-primary";
  return (
    <div className={`rounded-lg border border-border bg-card px-4 py-3 border-s-4 ${bar}`}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-black text-foreground">{value}</div>
    </div>
  );
}

function CreateConsignmentModal({
  lang,
  isRtl,
  onClose,
  onCreated,
}: {
  lang: string;
  isRtl: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    partyName: "",
    title: "",
    referenceNo: "",
    baseCurrency: "USD",
    consignmentDate: new Date().toISOString().slice(0, 10),
    partyContact: "",
    partyPhone: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.partyName.trim()) {
      setError(t(lang, "cns.err_party_required", "Party name is required."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createConsignmentReq(form);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-lg font-black text-foreground">{t(lang, "cns.new", "New Consignment")}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t(lang, "cns.party_name", "Party Name")} required>
            <input value={form.partyName} onChange={(e) => set("partyName", e.target.value)} className="modal-input" />
          </Field>
          <Field label={t(lang, "cns.reference_no", "Reference No")}>
            <input value={form.referenceNo} onChange={(e) => set("referenceNo", e.target.value)} className="modal-input" />
          </Field>
          <Field label={t(lang, "cns.f_title", "Title / Description")}>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} className="modal-input" />
          </Field>
          <Field label={t(lang, "cns.consignment_date", "Consignment Date")}>
            <input type="date" value={form.consignmentDate} onChange={(e) => set("consignmentDate", e.target.value)} className="modal-input" />
          </Field>
          <Field label={t(lang, "cns.base_currency", "Base Currency")}>
            <select value={form.baseCurrency} onChange={(e) => set("baseCurrency", e.target.value)} className="modal-input">
              {CCY.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t(lang, "cns.party_contact", "Contact Person")}>
            <input value={form.partyContact} onChange={(e) => set("partyContact", e.target.value)} className="modal-input" />
          </Field>
          <Field label={t(lang, "cns.party_phone", "Phone")}>
            <input value={form.partyPhone} onChange={(e) => set("partyPhone", e.target.value)} className="modal-input" />
          </Field>
          <Field label={t(lang, "cns.notes", "Notes")} full>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="modal-input" />
          </Field>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            {t(lang, "cns.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {t(lang, "cns.save", "Save")}
          </button>
        </div>
      </div>
      <style jsx>{`
        .modal-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.4rem 0.6rem;
          font-size: 0.875rem;
          outline: none;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  full,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`block text-xs font-semibold text-muted-foreground ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
