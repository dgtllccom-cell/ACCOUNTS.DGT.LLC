"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { openJournalReportWindow } from "@/lib/reports/open-journal-report-window";

type Field = { key: string; label: string; value: string; strong?: boolean };
type PartyCard = { linked: boolean; titleKey: string; titleLabel: string; fields: Field[]; noteKey?: string; noteLabel?: string; viaKey?: string; viaLabel?: string; via?: string };
type LinesBlock = { columns: Array<{ key: string; label: string; num?: boolean }>; rows: Array<Record<string, string>>; totals?: Record<string, string> };
type Detail = {
  found: boolean;
  module: string;
  moduleLabel: string;
  header: { entryNo: string; status: string; subtitle: string };
  origin: { country: string; branch: string; sourceModule: string; recordId: string };
  general: Field[];
  party: PartyCard | null;
  bank: PartyCard | null;
  amounts: Array<{ key: string; label: string; value: string; tone?: string }> | null;
  lines: LinesBlock | null;
  workflow: { statusKey: string; statusLabel: string; status: string; steps: Field[] } | null;
  audit: Array<{ actor: string; action: string; at: string }>;
  attachments: Array<{ name: string; mime: string; size: number; at: string }>;
};

function fmtDate(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

export function EntryDetailView({ id, module = "Roznamcha", src = "Roznamcha", lang: langProp = "en" }: { id: string; module?: string; src?: string; lang?: string }) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  const lang = (activeLang || langProp) as any;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = useCallback((key: string, fallback: string) => t(lang, key as never, fallback), [lang]);
  // A field/column carries its own i18n key + English fallback → translate reactively, keep data verbatim.
  const tf = useCallback((x: { key: string; label: string }) => t(lang, x.key as never, x.label), [lang]);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const qs = new URLSearchParams({ module, src }).toString();
        const res = await apiGet<Detail>(`/api/erp/super-admin/activity/${id}?${qs}`);
        if (alive) setData(res);
      } catch (e: any) {
        if (alive) setError(e?.message || "Failed to load entry");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, module, src]);

  const statusClass = (s: string) => {
    const v = String(s || "").toLowerCase();
    if (v.includes("post") || v.includes("final") || v.includes("complete") || v.includes("active") || v.includes("paid") || v.includes("approved")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    if (v.includes("pend") || v.includes("partial") || v.includes("draft") || v.includes("due")) return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  };

  function buildReport(autoPrint: boolean) {
    if (!data?.found) return null;
    const chips = [
      { label: tt("sae.module", "Module"), value: data.moduleLabel },
      { label: tt("rozrep.country", "Country"), value: data.origin.country || undefined },
      { label: tt("rozrep.branch", "Branch"), value: data.origin.branch || undefined },
      { label: tt("acct.status", "Status"), value: data.header.status || undefined }
    ];
    const kpis = (data.amounts || []).map((x) => ({ label: tf(x), value: x.value, tone: (x.tone as any) || "open" }));
    // Prefer real ledger lines; otherwise a general-fields table so print still carries the full record.
    const useLines = data.lines && data.lines.rows.length > 0;
    return {
      lang, autoPrint,
      title: `${tt("sed.entry_details", "Entry Details")} — ${data.header.entryNo}`,
      subtitle: data.header.subtitle || data.moduleLabel,
      overviewLabel: tt("sed.general_info", "General Information"),
      scopeName: data.header.entryNo,
      reportIdPrefix: "ERP", reportIdValue: data.header.entryNo,
      chips, kpis,
      columns: useLines
        ? data.lines!.columns.map((c) => ({ key: c.key, label: tf(c), num: c.num }))
        : [{ key: "field", label: tt("sae.field", "Field") }, { key: "value", label: tt("sae.value", "Value") }],
      rows: useLines
        ? data.lines!.rows
        : data.general.map((g) => ({ field: tf(g), value: g.value }))
    };
  }
  function printEntry() { const cfg = buildReport(true); if (cfg) openJournalReportWindow(cfg as any); }

  function exportExcel() {
    if (!data?.found) return;
    const useLines = data.lines && data.lines.rows.length > 0;
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    let rows: string[];
    if (useLines) {
      const cols = data.lines!.columns;
      rows = [cols.map((c) => esc(tf(c))).join(",")];
      data.lines!.rows.forEach((r) => rows.push(cols.map((c) => esc(r[c.key] ?? "")).join(",")));
    } else {
      rows = [[esc(tt("sae.field", "Field")), esc(tt("sae.value", "Value"))].join(",")];
      data.general.forEach((g) => rows.push([esc(tf(g)), esc(g.value)].join(",")));
    }
    const blob = new Blob(["﻿" + rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `entry-${data.header.entryNo}.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  const Field = ({ label, value, strong }: { label: string; value?: string; strong?: boolean }) => (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm ${strong ? "font-black text-emerald-600" : "font-semibold"} break-words`}>{value || "-"}</div>
    </div>
  );

  const PartySection = ({ card }: { card: PartyCard }) => (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-black">{tt(card.titleKey, card.titleLabel)}</h2>
        {card.linked
          ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{card.viaKey ? tt(card.viaKey, card.viaLabel || "Linked via") : ""} {card.via}</span>
          : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800">{tt("sed.state_not_linked", "Not linked")}</span>}
      </div>
      {card.linked
        ? <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">{card.fields.map((x, i) => <Field key={i} label={tf(x)} value={x.value} />)}</div>
        : <div className="text-xs text-slate-400">{tt(card.noteKey || "sed.state_not_linked", card.noteLabel || "Not linked")}{card.fields.length > 0 && <span className="ms-2 text-slate-500">— {card.fields.map((x) => x.value).join(", ")}</span>}</div>}
    </section>
  );

  if (loading) return <div className="p-8 text-center text-sm text-slate-400">{tt("sae.loading", "Loading ERP activity...")}</div>;
  if (error) return <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>;
  if (!data?.found) {
    return (
      <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
        <button onClick={() => router.push("/dashboard/all-release-entries")} className="text-sm font-bold text-blue-600">← {tt("sed.back", "Back")}</button>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">{tt("sed.not_found", "Entry not found")}</div>
      </div>
    );
  }

  const d = data;
  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-100" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button onClick={() => router.push("/dashboard/all-release-entries")} className="mt-1 rounded-lg bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">←</button>
            <div>
              <div className="text-[11px] font-semibold text-slate-400">{tt("sae.title", "All Release Entries")} / {tt("sed.entry_details", "Entry Details")}</div>
              <h1 className="mt-0.5 text-xl font-black">{tt("sed.entry_details", "Entry Details")} — #{d.header.entryNo}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {d.header.status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(d.header.status)}`}>{d.header.status}</span>}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{d.moduleLabel}</span>
                {d.origin.country && <span>📍 {d.origin.country}{d.origin.branch ? " · " + d.origin.branch : ""}</span>}
                <span className="text-slate-400">{tt("sed.source_module", "Source Module")}: {d.origin.sourceModule}</span>
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
          {d.general.map((g, i) => <Field key={i} label={tf(g)} value={g.value} strong={g.strong} />)}
        </div>
        {d.header.subtitle && (
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">{tt("sed.description", "Description")}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{d.header.subtitle}</div>
          </div>
        )}
      </section>

      {/* Party / Bank */}
      {d.party && <PartySection card={d.party} />}
      {d.bank && <PartySection card={d.bank} />}

      {/* Amounts Summary */}
      {d.amounts && d.amounts.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-black">{tt("sed.amounts_summary", "Amounts Summary")}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {d.amounts.map((x, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="text-[10px] font-bold uppercase text-slate-500">{tf(x)}</div>
                <div className={`mt-1 text-base font-black ${x.tone === "debit" ? "text-rose-600" : x.tone === "credit" ? "text-emerald-600" : ""}`}>{x.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Debit / Credit Details (real ledger lines) */}
      {d.lines && d.lines.rows.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-black">{tt("sed.debit_credit_details", "Debit / Credit Details")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-950/50">
                <tr>
                  <th className="p-2 text-start">#</th>
                  {d.lines.columns.map((c) => <th key={c.key} className={`p-2 ${c.num ? "text-end" : "text-start"}`}>{tf(c)}</th>)}
                </tr>
              </thead>
              <tbody>
                {d.lines.rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-2 text-slate-400">{i + 1}</td>
                    {d.lines!.columns.map((c) => <td key={c.key} className={`p-2 ${c.num ? "text-end font-mono" : ""} ${c.key === "debit" ? "text-rose-600" : c.key === "credit" ? "text-emerald-600" : ""}`}>{r[c.key] ?? "-"}</td>)}
                  </tr>
                ))}
              </tbody>
              {d.lines.totals && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-black text-blue-700 dark:border-slate-700 dark:text-blue-300">
                    <td className="p-2" colSpan={Math.max(1, d.lines.columns.length - 2)}>{tt("sed.total", "Total")}</td>
                    {d.lines.columns.filter((c) => c.num).map((c) => <td key={c.key} className="p-2 text-end font-mono">{d.lines!.totals![c.key] ?? "-"}</td>)}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {/* Workflow / Status */}
      {d.workflow && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-black">{tt("sed.sec_workflow", "Workflow / Status")}</h2>
            {d.workflow.status && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(d.workflow.status)}`}>{d.workflow.status}</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
            {d.workflow.steps.map((s, i) => <Field key={i} label={tf(s)} value={s.value} strong={s.strong} />)}
          </div>
        </section>
      )}

      {/* Audit Trail */}
      {d.audit.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-sm font-black">{tt("sed.audit_trail", "Audit Trail")}</h2>
          <ol className="space-y-3">
            {d.audit.map((ev, i) => (
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

      {/* Documents / Attachments (only real files) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-black">{tt("sed.attachments", "Documents / Attachments")}</h2>
        {d.attachments.length === 0
          ? <div className="text-xs text-slate-400">{tt("sed.no_attachments", "No documents attached")}</div>
          : <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{d.attachments.map((fdoc, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
                <div className="truncate font-semibold" title={fdoc.name}>{fdoc.name}</div>
                <div className="mt-1 text-[10px] text-slate-400">{fdoc.mime} · {(fdoc.size / 1024).toFixed(0)} KB</div>
              </div>
            ))}</div>}
      </section>
    </div>
  );
}
