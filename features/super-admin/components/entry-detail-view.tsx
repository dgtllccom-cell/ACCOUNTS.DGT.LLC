"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { openJournalReportWindow } from "@/lib/reports/open-journal-report-window";

type Line = {
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
  usdRate: number;
  usdAmount: number;
  party: string;
};

type Detail = {
  found: boolean;
  general?: {
    entryNo: string; voucherNo: string; journalNo: string; referenceNo: string;
    entryType: string; sourceModule: string; category: string; description: string;
    status: string; date: string; createdAt: string; postedAt: string; approvedAt: string;
    createdBy: string; approvedBy: string; country: string; branch: string;
    currency: string; exchangeRate: number;
  };
  amounts?: { totalDebit: number; totalCredit: number; totalUsd: number; net: number; currency: string };
  lines?: Line[];
  audit?: Array<{ action: string; actor: string; at: string }>;
  attachments?: Array<{ name: string; mime: string; size: number; at: string }>;
};

function fmtMoney(n: number) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

export function EntryDetailView({ id, lang: langProp = "en" }: { id: string; lang?: string }) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  const lang = (activeLang || langProp) as any;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = useCallback((key: string, fallback: string) => t(lang, key as never, fallback), [lang]);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await apiGet<Detail>(`/api/erp/super-admin/activity/${id}`);
        if (alive) setData(res);
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load entry");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const g = data?.general;
  const a = data?.amounts;
  const lines = data?.lines ?? [];
  const audit = data?.audit ?? [];
  const attachments = data?.attachments ?? [];

  const statusClass = (s: string) => {
    const v = String(s || "").toLowerCase();
    if (v.includes("post") || v.includes("final") || v.includes("complete") || v.includes("active")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    if (v.includes("pend") || v.includes("partial") || v.includes("draft")) return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  };

  function buildReport(autoPrint: boolean) {
    if (!g || !a) return null;
    return {
      lang, autoPrint,
      title: `${tt("sed.entry_details", "Entry Details")} — ${g.entryNo}`,
      subtitle: g.description || g.entryType,
      overviewLabel: tt("sed.general_info", "General Information"),
      scopeName: g.entryNo,
      reportIdPrefix: "ERP",
      reportIdValue: g.entryNo,
      chips: [
        { label: tt("sed.entry_type", "Entry Type"), value: g.entryType },
        { label: tt("rozrep.country", "Country"), value: g.country },
        { label: tt("rozrep.branch", "Branch"), value: g.branch },
        { label: tt("acct.status", "Status"), value: g.status }
      ],
      kpis: [
        { label: tt("bankroz.total_debit", "Total Debit"), value: fmtMoney(a.totalDebit), tone: "debit" as const },
        { label: tt("bankroz.total_credit", "Total Credit"), value: fmtMoney(a.totalCredit), tone: "credit" as const },
        { label: tt("sed.total_usd", "Total (USD)"), value: fmtMoney(a.totalUsd), tone: "current" as const },
        { label: tt("sed.net_balance", "Net Balance"), value: fmtMoney(a.net), tone: "open" as const }
      ],
      columns: [
        { key: "code", label: tt("sed.account_code", "Account Code") },
        { key: "name", label: tt("sed.account_name", "Account Name") },
        { key: "desc", label: tt("sed.description", "Description") },
        { key: "debit", label: tt("rozrep.debit", "Debit"), num: true },
        { key: "credit", label: tt("rozrep.credit", "Credit"), num: true },
        { key: "usd", label: tt("sed.total_usd", "USD"), num: true }
      ],
      rows: lines.map((l) => ({
        code: l.accountCode, name: l.accountName, desc: l.description,
        debit: l.debit ? fmtMoney(l.debit) : "-", credit: l.credit ? fmtMoney(l.credit) : "-",
        usd: l.usdAmount ? fmtMoney(l.usdAmount) : "-"
      }))
    };
  }

  function printEntry() {
    const cfg = buildReport(true);
    if (cfg) openJournalReportWindow(cfg);
  }

  function exportExcel() {
    if (!g) return;
    const cols: Array<[string, (l: Line) => string]> = [
      [tt("sed.account_code", "Account Code"), (l) => l.accountCode],
      [tt("sed.account_name", "Account Name"), (l) => l.accountName],
      [tt("sed.description", "Description"), (l) => l.description],
      [tt("rozrep.debit", "Debit"), (l) => String(l.debit || "")],
      [tt("rozrep.credit", "Credit"), (l) => String(l.credit || "")],
      [tt("rozrep.currency", "Currency"), (l) => l.currency],
      [tt("sed.total_usd", "USD"), (l) => String(l.usdAmount || "")]
    ];
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [cols.map(([h]) => esc(h)).join(",")];
    lines.forEach((l) => rows.push(cols.map(([, f]) => esc(f(l))).join(",")));
    const blob = new Blob(["﻿" + rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `entry-${g.entryNo}.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  const Field = ({ label, value, strong }: { label: string; value?: string; strong?: boolean }) => (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm ${strong ? "font-black text-emerald-600" : "font-semibold"}`}>{value || "-"}</div>
    </div>
  );

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">{tt("sae.loading", "Loading ERP activity...")}</div>;
  if (error) return <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>;
  if (!data?.found || !g || !a) {
    return (
      <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
        <button onClick={() => router.push("/dashboard/all-release-entries")} className="text-sm font-bold text-blue-600">← {tt("sed.back", "Back")}</button>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">{tt("sed.not_found", "Entry not found")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-100" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button onClick={() => router.push("/dashboard/all-release-entries")} className="mt-1 rounded-lg bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">←</button>
            <div>
              <div className="text-[11px] font-semibold text-slate-400">{tt("sae.title", "All Release Entries")} / {tt("sed.entry_details", "Entry Details")}</div>
              <h1 className="mt-0.5 text-xl font-black">{tt("sed.entry_details", "Entry Details")} — #{g.entryNo}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(g.status)}`}>{g.status}</span>
                <span>{g.entryType}</span>
                {g.createdAt && <span>{tt("acct.created_by", "Created By")}: {fmtDate(g.createdAt)}</span>}
                {g.postedAt && <span>{tt("sed.posting_date", "Posting Date")}: {fmtDate(g.postedAt)}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={printEntry} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">🖨 {tt("common.print", "Print")}</button>
            <button onClick={printEntry} className="rounded-lg border border-rose-400 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">PDF</button>
            <button onClick={exportExcel} className="rounded-lg border border-emerald-500 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30">⬇ {tt("sed.excel", "Excel")}</button>
          </div>
        </div>
      </div>

      {/* General Information */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-black">{tt("sed.general_info", "General Information")}</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          <Field label={tt("bankroz.entry_no", "Entry No")} value={g.entryNo} />
          <Field label={tt("rozrep.date", "Date")} value={fmtDate(g.date)} />
          <Field label={tt("rozrep.country", "Country")} value={g.country} />
          <Field label={tt("sed.entry_type", "Entry Type")} value={g.entryType} />
          <Field label={tt("sed.posting_date", "Posting Date")} value={fmtDate(g.postedAt)} />
          <Field label={tt("rozrep.branch", "Branch")} value={g.branch} />
          <Field label={tt("acct.reference_no", "Reference No")} value={g.referenceNo} />
          <Field label={tt("acct.status", "Status")} value={g.status} />
          <Field label={tt("rozrep.currency", "Currency")} value={g.currency} />
          <Field label={tt("sed.source_module", "Source Module")} value={g.sourceModule} />
          <Field label={tt("acct.created_by", "Created By")} value={g.createdBy} />
          <Field label={tt("sed.exchange_rate", "Exchange Rate")} value={g.exchangeRate ? `1 ${g.currency || ""} = ${g.exchangeRate} USD` : "-"} />
          <Field label={tt("sed.approved_date", "Approved Date")} value={fmtDate(g.approvedAt)} />
          <Field label={tt("vch.approved_by", "Approved By")} value={g.approvedBy} />
          <Field label={tt("sed.final_usd", "Final Amount (USD)")} value={fmtMoney(a.totalUsd)} strong />
        </div>
        {g.description && (
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">{tt("sed.description", "Description")}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{g.description}</div>
          </div>
        )}
      </section>

      {/* Amounts Summary */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-black">{tt("sed.amounts_summary", "Amounts Summary")}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { k: tt("bankroz.total_debit", "Total Debit"), v: fmtMoney(a.totalDebit) + (a.currency ? " " + a.currency : ""), c: "text-rose-600" },
            { k: tt("bankroz.total_credit", "Total Credit"), v: fmtMoney(a.totalCredit) + (a.currency ? " " + a.currency : ""), c: "text-emerald-600" },
            { k: tt("sed.total_usd", "Total (USD)"), v: fmtMoney(a.totalUsd) + " USD", c: "" },
            { k: tt("sed.net_balance", "Net Balance"), v: fmtMoney(a.net) + (a.currency ? " " + a.currency : ""), c: "" }
          ].map((x, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-[10px] font-bold uppercase text-slate-500">{x.k}</div>
              <div className={`mt-1 text-base font-black ${x.c}`}>{x.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Debit / Credit Details */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-black">{tt("sed.debit_credit_details", "Debit / Credit Details")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-950/50">
              <tr>
                <th className="p-2 text-start">#</th>
                <th className="p-2 text-start">{tt("sed.account_code", "Account Code")}</th>
                <th className="p-2 text-start">{tt("sed.account_name", "Account Name")}</th>
                <th className="p-2 text-start">{tt("sed.description", "Description")}</th>
                <th className="p-2 text-end">{tt("rozrep.debit", "Debit")}</th>
                <th className="p-2 text-end">{tt("rozrep.credit", "Credit")}</th>
                <th className="p-2 text-end">{tt("sed.total_usd", "USD")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="p-2 text-slate-400">{i + 1}</td>
                  <td className="p-2 font-mono">{l.accountCode || "-"}</td>
                  <td className="p-2 font-semibold">{l.accountName || "-"}</td>
                  <td className="p-2 max-w-[280px] truncate" title={l.description}>{l.description || "-"}</td>
                  <td className="p-2 text-end font-mono text-rose-600">{l.debit ? fmtMoney(l.debit) : "-"}</td>
                  <td className="p-2 text-end font-mono text-emerald-600">{l.credit ? fmtMoney(l.credit) : "-"}</td>
                  <td className="p-2 text-end font-mono">{l.usdAmount ? fmtMoney(l.usdAmount) : "-"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-black text-blue-700 dark:border-slate-700 dark:text-blue-300">
                <td className="p-2" colSpan={4}>{tt("sed.total", "Total")}</td>
                <td className="p-2 text-end font-mono">{fmtMoney(a.totalDebit)}</td>
                <td className="p-2 text-end font-mono">{fmtMoney(a.totalCredit)}</td>
                <td className="p-2 text-end font-mono">{fmtMoney(a.totalUsd)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Audit Trail (real) */}
      {audit.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-black">{tt("sed.audit_trail", "Audit Trail")}</h2>
          <ol className="space-y-3">
            {audit.map((ev, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-blue-500" />
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="font-bold">{ev.actor || "-"}</span>
                    <span className="ms-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{ev.action}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{fmtDate(ev.at)}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Documents / Attachments (only shown when real files exist) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-black">{tt("sed.attachments", "Documents / Attachments")}</h2>
        {attachments.length === 0 ? (
          <div className="text-xs text-slate-400">{tt("sed.no_attachments", "No documents attached")}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {attachments.map((f, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                <div className="truncate font-semibold" title={f.name}>{f.name}</div>
                <div className="mt-1 text-[10px] text-slate-400">{f.mime} · {(f.size / 1024).toFixed(0)} KB</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
