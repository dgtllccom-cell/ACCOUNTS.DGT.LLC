import { translateHeader } from "@/lib/i18n/table-headers";
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
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  format?: "date" | "currency" | "number" | "status" | "text";
  currency?: string;
  render?: (value: unknown, row: Record<string, unknown>) => string;
};

function formatCellValue(value: unknown, column: GenericReportColumn, lang: string): string {
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
  return translateHeader(str, lang);
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
  const headers = columns.map((column) => `"${translateHeader(column.label, lang).replace(/"/g, '""')}"`).join(",");
  const lines = rows.map((row) =>
    columns
      .map((column) => `"${formatCellValue(row[column.key], column, lang).replace(/"/g, '""')}"`)
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
      const label = translateHeader(rawLabel, lang);
      const color: ERPKpiCard["color"][] = ["blue", "green", "amber", "slate", "red", "blue", "green", "amber"];
      return {
        label,
        value:
          typeof value === "number"
            ? key.toLowerCase().includes("amount") || key.toLowerCase().includes("debit") || key.toLowerCase().includes("credit") || key.toLowerCase().includes("balance") || key.toLowerCase().includes("price")
              ? formatMoney(value, currency)
              : formatNumber(value)
            : translateHeader(String(value), lang),
        color: color[index] ?? "slate",
      };
    });
}

export function openGenericErpReport(input: {
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
}) {
  if (typeof window === "undefined") return;

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

  const translatedTitle = translateHeader(title, lang);
  const translatedSubtitle = subtitle ? translateHeader(subtitle, lang) : undefined;
  const translatedFilters = filters.map(f => ({
    label: translateHeader(f.label, lang),
    value: translateHeader(f.value, lang)
  }));

  const tableHtml = `
    ${translatedSubtitle ? `<div style="margin-bottom:6px;font-size:10px;font-weight:700;color:#475569;">${escapeHtml(translatedSubtitle)}</div>` : ""}
    <table class="data-table">
      <thead>
        <tr>
          ${columns.map((column) => `<th>${escapeHtml(translateHeader(column.label, lang))}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map(
                  (row) => `
              <tr>
                ${columns.map((column) => `<td>${renderCell(row[column.key], column, row, lang)}</td>`).join("")}
              </tr>`
                )
                .join("")
            : `<tr><td colspan="${Math.max(columns.length, 1)}" style="text-align:center;padding:18px;">${escapeHtml(translateHeader("No records found", lang))}</td></tr>`
        }
        ${
          totalsRow
            ? `<tr class="total-row">
                ${columns
                  .map((column, idx) => {
                    const val = totalsRow[column.key];
                    const align = column.align === "right" ? "right" : column.align === "center" ? "center" : "left";
                    if (val !== undefined && val !== null) {
                      return `<td><span style="display:block;text-align:${align};">${escapeHtml(formatCellValue(val, column, lang))}</span></td>`;
                    }
                    if (idx === 0) {
                      return `<td><strong>${escapeHtml(translateHeader("TOTAL", lang))}</strong></td>`;
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

  const preview = window.open("", "_blank", "noopener,noreferrer");
  if (!preview) return;
  preview.document.open();
  preview.document.write(html);
  preview.document.close();
}

