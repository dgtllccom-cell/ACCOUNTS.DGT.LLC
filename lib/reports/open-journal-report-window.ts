import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { renderA4Document, escapeReportHtml, A4_SHARED_CSS } from "@/lib/reports/report-shell";

/**
 * Reusable daily / period JOURNAL print engine (General/Cash/Bank Roznamcha, Purchase, Sales,
 * Transfer, Expense journals, ledger statements). One engine, thin per-module config. Renders a dark
 * overview banner with the journal name + scope + summary KPIs (opening / total debit / total credit /
 * closing / entry count), a chip row of the active filters/date range/scope, and a full-width data
 * table with repeated header across pages. Labels come from the central dictionary; real data only.
 */

export type JournalColumn = { key: string; label: string; num?: boolean; align?: "start" | "center" | "end" };
export type JournalKpi = { label: string; value: string; tone?: "open" | "current" | "debit" | "credit" | "neutral" };
export type JournalChip = { label: string; value: string | null | undefined };

export type JournalReportConfig = {
  lang?: string;
  autoPrint?: boolean;
  title: string;
  subtitle: string;
  overviewLabel: string;   // "Journal Overview" translated
  scopeName: string;       // e.g. journal display name / branch scope
  status?: string;
  chips: JournalChip[];    // date range, branch, user, currency, filters
  kpis: JournalKpi[];      // 0..4 summary cards
  columns: JournalColumn[];
  rows: Array<Record<string, string | null | undefined>>;
  totals?: Record<string, string | null | undefined>;
  createdBy?: string;
  reportIdPrefix?: string;
  reportIdValue?: string;
  signatures?: string[];
};

export function openJournalReportWindow(config: JournalReportConfig) {
  if (typeof window === "undefined") return;
  const lang = (config.lang || "en") as SupportedLanguage;
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const e = escapeReportHtml;
  const DASH = tt("acct.no_data", "-");
  const cell = (v: string | null | undefined) => (v === null || v === undefined || String(v).trim() === "" ? DASH : e(v));

  const toneClass: Record<string, string> = { open: "kpi-open", current: "kpi-current", debit: "kpi-debit", credit: "kpi-credit", neutral: "kpi-current" };
  const kpiCells = (config.kpis || [])
    .map((k) => `<div class="kpi"><span class="kpi-label">${e(k.label)}</span><div class="kpi-val ${toneClass[k.tone || "neutral"]}">${e(k.value)}</div></div>`)
    .join("");
  const chips = (config.chips || [])
    .filter((c) => c.value !== null && c.value !== undefined && String(c.value).trim() !== "")
    .map((c) => `<span class="chip"><b>${e(c.label)}:</b> ${e(c.value)}</span>`)
    .join("");

  const align = (c: JournalColumn) => c.num ? "end" : (c.align || "start");
  const thead = `<tr>${config.columns.map((c) => `<th style="text-align:${align(c)}">${e(c.label)}</th>`).join("")}</tr>`;
  const tbody = (config.rows || []).length
    ? config.rows.map((r) => `<tr>${config.columns.map((c) => `<td class="${c.num ? "num" : ""}" style="text-align:${align(c)}">${cell(r[c.key])}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${config.columns.length}" style="text-align:center;color:#94a3b8;padding:16px;">${tt("report.builder_no_records", "No records found")}</td></tr>`;
  const tfoot = config.totals
    ? `<tfoot><tr>${config.columns.map((c, i) => {
        const v = config.totals![c.key];
        const empty = v === undefined || v === null || String(v).trim() === "";
        const content = empty ? (i === 0 ? e(tt("bankroz.totals", "Totals")) : "") : e(v);
        return `<td class="${c.num ? "num" : ""}" style="text-align:${align(c)}">${content}</td>`;
      }).join("")}</tr></tfoot>`
    : "";

  const bodyHtml = `
    <div class="overview-banner">
      <div class="overview-top">
        <div><div class="overview-title">${e(config.overviewLabel)}</div><div class="overview-name">${cell(config.scopeName)}</div></div>
        ${config.status ? `<span class="overview-status">${cell(config.status)}</span>` : ""}
      </div>
      ${kpiCells ? `<div class="overview-kpis">${kpiCells}</div>` : ""}
    </div>
    ${chips ? `<div class="chip-row">${chips}</div>` : ""}
    <table class="data-table"><thead>${thead}</thead><tbody>${tbody}</tbody>${tfoot}</table>
  `;

  renderA4Document({
    lang,
    autoPrint: config.autoPrint,
    title: config.title,
    subtitle: config.subtitle,
    reportType: config.subtitle,
    createdBy: config.createdBy,
    bodyHtml,
    reportId: `${config.reportIdPrefix || "JRN"}-${(config.reportIdValue || "").replace(/[^a-zA-Z0-9-]/g, "") || "ALL"}`,
    signatures: config.signatures,
  });
  void A4_SHARED_CSS; // css is applied inside renderA4Document
}
