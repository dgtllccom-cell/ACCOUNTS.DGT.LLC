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
};

function formatCellValue(value: unknown, column: GenericReportColumn): string {
  if (value === null || value === undefined || value === "") return "—";

  if (column.format === "date") {
    return formatDate(String(value));
  }

  if (column.format === "currency") {
    return formatMoney(value, column.currency);
  }

  if (column.format === "number") {
    return formatNumber(value);
  }

  return String(value);
}

function renderCell(value: unknown, column: GenericReportColumn): string {
  const formatted = formatCellValue(value, column);
  if (column.format === "status") {
    const status = String(value ?? "").toLowerCase();
    const badgeClass = status === "posted" || status === "active" || status === "approved"
      ? "badge-green"
      : status === "pending" || status === "draft"
      ? "badge-amber"
      : status === "rejected" || status === "cancelled"
      ? "badge-red"
      : "badge-slate";
    return `<span class="badge ${badgeClass}">${escapeHtml(formatted)}</span>`;
  }

  const align = column.align === "right" ? "right" : column.align === "center" ? "center" : "left";
  return `<span style="display:block;text-align:${align};">${escapeHtml(formatted)}</span>`;
}

function buildCsv(columns: GenericReportColumn[], rows: Record<string, unknown>[]) {
  const headers = columns.map((column) => `"${column.label.replace(/"/g, '""')}"`).join(",");
  const lines = rows.map((row) =>
    columns
      .map((column) => `"${formatCellValue(row[column.key], column).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [headers, ...lines].join("\n");
}

function buildKpis(summary: Record<string, unknown>, currency?: string): ERPKpiCard[] {
  return Object.entries(summary)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 6)
    .map(([key, value], index) => {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/^./, (letter) => letter.toUpperCase());
      const color: ERPKpiCard["color"][] = ["blue", "green", "amber", "slate", "red", "blue"];
      return {
        label,
        value:
          typeof value === "number"
            ? key.toLowerCase().includes("amount") || key.toLowerCase().includes("debit") || key.toLowerCase().includes("credit") || key.toLowerCase().includes("balance")
              ? formatMoney(value, currency)
              : formatNumber(value)
            : String(value),
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
    filters = [],
    companyInfo = {},
    orientation = columns.length > 6 ? "landscape" : "portrait",
    footerNotesHtml,
    legendHtml,
  } = input;

  const tableHtml = `
    ${subtitle ? `<div style="margin-bottom:6px;font-size:10px;font-weight:700;color:#475569;">${escapeHtml(subtitle)}</div>` : ""}
    <table class="data-table">
      <thead>
        <tr>
          ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${
          rows.length
            ? rows
                .map(
                  (row) => `
              <tr>
                ${columns.map((column) => `<td>${renderCell(row[column.key], column)}</td>`).join("")}
              </tr>`
                )
                .join("")
            : `<tr><td colspan="${Math.max(columns.length, 1)}" style="text-align:center;padding:18px;">No records found</td></tr>`
        }
      </tbody>
    </table>
  `;

  const currency =
    companyInfo.currency ||
    columns.find((column) => column.format === "currency")?.currency ||
    undefined;

  const html = generateReportHtml({
    title,
    subtitle,
    orientation,
    companyInfo,
    filters,
    kpis: buildKpis(summary, currency),
    mainTableHtml: tableHtml,
    footerNotesHtml,
    legendHtml,
    lang,
    csvData: buildCsv(columns, rows),
  });

  const preview = window.open("", "_blank", "noopener,noreferrer");
  if (!preview) return;
  preview.document.open();
  preview.document.write(html);
  preview.document.close();
}
