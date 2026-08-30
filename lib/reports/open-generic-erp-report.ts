import { translateHeader } from "@/lib/i18n/table-headers";
import { printStore } from "@/lib/store/print-store";
import {
  escapeHtml,
  formatDate,
  formatMoney,
  formatNumber,
  generateReportHtml,
  type ERPCompanyInfo,
  type ERPFilterPill,
  type ERPKpiCard,
} from "./erp-report-template-builder";

export type GenericReportColumn = {
  key: string | ((row: Record<string, unknown>) => unknown);
  label: string;
  align?: "left" | "center" | "right";
  format?: "date" | "currency" | "number" | "status" | "text";
  currency?: string;
  render?: (value: unknown, row: Record<string, unknown>) => string;
};

export function getRowValue(row: Record<string, unknown>, key: GenericReportColumn["key"]) {
  return typeof key === "function" ? key(row) : row[key];
}

export function formatCellValue(value: unknown, column: GenericReportColumn, lang: string): string {
  if (value === null || value === undefined || value === "") return "—";

  if (column.render) {
    return column.render(value, {});
  }

  if (column.format === "date") {
    return formatDate(String(value));
  }

  if (column.format === "currency") {
    return formatMoney(value, column.currency);
  }

  if (column.format === "number") {
    return formatNumber(value);
  }

  const str = String(value);
  // Check if string needs translation via dictionary
  return translateHeader(lang, str);
}

function renderCell(value: unknown, column: GenericReportColumn, row: Record<string, unknown>, lang: string): string {
  let text = "";
  if (column.render) {
    text = column.render(value, row);
  } else {
    text = formatCellValue(value, column, lang);
  }

  if (column.format === "status") {
    const status = String(value ?? "").toLowerCase();
    const badgeClass =
      status === "posted" || status === "active" || status === "approved" || status === "completed" || status === "transferred"
        ? "badge-green"
        : status === "pending" || status === "draft" || status === "accepted (not transferred)"
        ? "badge-amber"
        : status === "rejected" || status === "cancelled"
        ? "badge-red"
        : "badge-slate";
    return `<span class="badge ${badgeClass}">${escapeHtml(text)}</span>`;
  }

  const align = column.align === "right" ? "right" : column.align === "center" ? "center" : "left";
  return `<span style="display:block;text-align:${align};">${escapeHtml(text)}</span>`;
}

function buildCsv(columns: GenericReportColumn[], rows: Record<string, unknown>[], lang: string) {
  const headers = columns.map((column) => `"${translateHeader(lang, column.label).replace(/"/g, '""')}"`).join(",");
  const lines = rows.map((row) =>
    columns
      .map((column) => {
        const value = getRowValue(row, column.key);
        return `"${formatCellValue(value, column, lang).replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [headers, ...lines].join("\n");
}

function buildKpis(summary: Record<string, unknown>, lang: string, currency?: string): ERPKpiCard[] {
  return Object.entries(summary)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 8)
    .map(([key, value], index) => {
      const rawLabel = key
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/^./, (letter) => letter.toUpperCase());
      const label = translateHeader(lang, rawLabel);
      const color: ERPKpiCard["color"][] = ["blue", "green", "amber", "slate", "red", "blue", "green", "amber"];
      return {
        label,
        value:
          typeof value === "number"
            ? key.toLowerCase().includes("amount") || key.toLowerCase().includes("debit") || key.toLowerCase().includes("credit") || key.toLowerCase().includes("balance") || key.toLowerCase().includes("price")
              ? formatMoney(value, currency)
              : formatNumber(value)
            : translateHeader(lang, String(value)),
        color: color[index] ?? "slate",
      };
    });
}

export function buildGenericErpReportHtml(input: {
  title: string;
  subtitle?: string;
  lang?: string;
  columns: GenericReportColumn[];
  rows: Record<string, unknown>[];
  summary?: Record<string, unknown>;
  totalsRow?: Record<string, unknown>;
  filters?: ERPFilterPill[];
  companyInfo?: ERPCompanyInfo;
  orientation?: "portrait" | "landscape";
  footerNotesHtml?: string;
  legendHtml?: string;
}): { html: string; title: string; filename: string } {
  const {
    title,
    subtitle,
    lang = "en",
    columns,
    rows,
    summary = {},
    totalsRow,
    filters = [],
    companyInfo = {},
    orientation = columns.length > 6 ? "landscape" : "portrait",
    footerNotesHtml,
    legendHtml,
  } = input;

  const translatedTitle = translateHeader(lang, title);
  const translatedSubtitle = subtitle ? translateHeader(lang, subtitle) : undefined;
  const translatedFilters = filters.map(f => ({
    label: translateHeader(lang, f.label),
    value: translateHeader(lang, f.value)
  }));

  const tableHtml = `
    ${translatedSubtitle ? `<div style="margin-bottom:6px;font-size:10px;font-weight:700;color:#475569;">${escapeHtml(translatedSubtitle)}</div>` : ""}
    <table class="data-table">
      <thead>
        <tr>
          ${columns.map((column) => `<th>${escapeHtml(translateHeader(lang, column.label))}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map(
                  (row) => `
              <tr>
                ${columns.map((column) => `<td>${renderCell(getRowValue(row, column.key), column, row, lang)}</td>`).join("")}
              </tr>`
                )
                .join("")
            : `<tr><td colspan="${Math.max(columns.length, 1)}" style="text-align:center;padding:64px 18px;color:#64748b;vertical-align:middle;">
                 <div style="font-size:22px;line-height:1;margin-bottom:8px;color:#cbd5e1;">▤</div>
                 <div style="font-size:13px;font-weight:600;">${escapeHtml(translateHeader(lang, "No records found"))}</div>
                 <div style="font-size:10px;margin-top:4px;color:#94a3b8;">${escapeHtml(translateHeader(lang, "No matching records for the selected filters"))}</div>
               </td></tr>`
        }
        ${
          totalsRow
            ? `<tr class="total-row">
                ${columns
                  .map((column, idx) => {
                    const val = getRowValue(totalsRow, column.key);
                    const align = column.align === "right" ? "right" : column.align === "center" ? "center" : "left";
                    if (val !== undefined && val !== null) {
                      return `<td><span style="display:block;text-align:${align};">${escapeHtml(formatCellValue(val, column, lang))}</span></td>`;
                    }
                    if (idx === 0) {
                      return `<td><strong>${escapeHtml(translateHeader(lang, "TOTAL"))}</strong></td>`;
                    }
                    return `<td></td>`;
                  })
                  .join("")}
              </tr>`
            : ""
        }
      </tbody>
    </table>
  `;

  const currency =
    companyInfo.currency ||
    columns.find((column) => column.format === "currency")?.currency ||
    "AED";

  const html = generateReportHtml({
    title: translatedTitle,
    subtitle: translatedSubtitle,
    orientation,
    companyInfo,
    filters: translatedFilters,
    kpis: buildKpis(summary, lang, currency),
    mainTableHtml: tableHtml,
    footerNotesHtml,
    legendHtml,
    lang,
    csvData: buildCsv(columns, rows, lang),
  });

  // ASCII-fold the (possibly RTL/localized) title for a safe, readable filename;
  // fall back to a transliterated slug, then a constant.
  const rawName = (translatedTitle || title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const safeName = rawName || "erp-report";
  const filename = `${safeName}-${new Date().toISOString().slice(0, 10)}.html`;

  return { html, title: translatedTitle || translateHeader(lang, "ERP Report"), filename };
}

export function downloadGenericErpReportHtml(input: Parameters<typeof buildGenericErpReportHtml>[0], customFilename?: string) {
  if (typeof window === "undefined") return;
  const { html, filename } = buildGenericErpReportHtml(input);
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = customFilename || filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openGenericErpReport(input: Parameters<typeof buildGenericErpReportHtml>[0]) {
  if (typeof window === "undefined") return;

  const { html, title } = buildGenericErpReportHtml(input);

  try {
    printStore.openPrint(html, title);
    return;
  } catch (e) {
    console.warn("Could not open in printStore, falling back to window.open", e);
  }

  const preview = window.open("", "_blank", "noopener,noreferrer");
  if (preview) {
    preview.document.open();
    preview.document.write(html);
    preview.document.close();
  }
}

