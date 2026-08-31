import type { ErpSession } from "@/lib/auth/session";

export type ProfessionalReportLayout = {
  title: string;
  subtitle?: string;
  company: {
    name: string;
    branchCode?: string;
  };
  scope: {
    country?: string;
    branch?: string;
    user?: string;
    level: "Global" | "Country" | "Branch";
  };
  dateRange?: {
    from: string;
    to: string;
  };
  generatedAt: string;
  generatedBy?: string;
  data: {
    headers: string[];
    rows: (string | number)[][];
    summary?: Record<string, string | number>;
  };
  pageInfo?: {
    currentPage?: number;
    totalPages?: number;
    rowsPerPage?: number;
    totalRows?: number;
  };
};

export function buildProfessionalReportLayout(
  title: string,
  data: {
    headers: string[];
    rows: (string | number)[][];
    summary?: Record<string, string | number>;
  },
  session: ErpSession,
  options: {
    dateRange?: { from: string; to: string };
    company?: string;
    branchCode?: string;
    subtitle?: string;
    currentPage?: number;
    totalPages?: number;
  }
): ProfessionalReportLayout {
  const now = new Date();
  const generatedAt = now.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Determine scope
  let scope = "Global";
  let scopeLabel = "Global";
  if (!session.isSuperAdmin) {
    if (session.cityBranchIds.length > 0) {
      scope = "Branch";
      scopeLabel = "Branch-Level";
    } else if (session.countryBranchIds.length > 0) {
      scope = "Country";
      scopeLabel = "Country-Level";
    } else if (session.countryIds.length > 0) {
      scope = "Country";
      scopeLabel = "Country-Level";
    }
  }

  return {
    title,
    subtitle: options.subtitle,
    company: {
      name: options.company || "",
      branchCode: options.branchCode,
    },
    scope: {
      country: session.countryIds?.[0],
      branch: session.cityBranchIds?.[0],
      user: session.fullName || session.email || undefined,
      level: (scope as "Global" | "Country" | "Branch") || "Global",
    },
    dateRange: options.dateRange,
    generatedAt,
    generatedBy: session.fullName || session.email || undefined,
    data,
    pageInfo: {
      currentPage: options.currentPage,
      totalPages: options.totalPages,
      rowsPerPage: data.rows.length,
      totalRows: data.rows.length,
    },
  };
}

/**
 * Converts report layout to HTML for Print Preview
 */
export function reportLayoutToHtml(report: ProfessionalReportLayout): string {
  const dateRangeText = report.dateRange
    ? `<tr><td colspan="2"><strong>Period:</strong> ${report.dateRange.from} to ${report.dateRange.to}</td></tr>`
    : "";

  const summaryRows = report.data.summary
    ? Object.entries(report.data.summary)
        .map(
          ([key, value]) =>
            `<tr style="border-top: 2px solid #333; font-weight: bold;">
            <td>${key}</td>
            <td style="text-align: right;">${typeof value === "number" ? value.toFixed(2) : value}</td>
          </tr>`
        )
        .join("")
    : "";

  const dataRows = report.data.rows
    .map(
      (row) =>
        `<tr>
        ${row
          .map(
            (cell, idx) =>
              `<td${idx === 0 ? "" : ' style="text-align: right;"'}>${
                typeof cell === "number" ? cell.toFixed(2) : cell
              }</td>`
          )
          .join("")}
      </tr>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 3px solid #333;
          padding-bottom: 10px;
        }
        .header h1 {
          margin: 5px 0;
          font-size: 20px;
        }
        .header p {
          margin: 2px 0;
          font-size: 12px;
          color: #666;
        }
        .info-table {
          width: 100%;
          margin-bottom: 20px;
          font-size: 12px;
        }
        .info-table td {
          padding: 4px 8px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .data-table th {
          background-color: #f0f0f0;
          border: 1px solid #ccc;
          padding: 8px;
          text-align: left;
          font-weight: bold;
          font-size: 12px;
        }
        .data-table td {
          border: 1px solid #ccc;
          padding: 6px 8px;
          font-size: 12px;
        }
        .footer {
          margin-top: 20px;
          font-size: 11px;
          color: #666;
          text-align: right;
        }
        @media print {
          body { margin: 0; }
          .header { border-bottom: 1px solid #000; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${report.title}</h1>
        ${report.subtitle ? `<p><strong>${report.subtitle}</strong></p>` : ""}
        <p>${report.company.name}${report.company.branchCode ? ` - ${report.company.branchCode}` : ""}</p>
      </div>

      <table class="info-table">
        <tr>
          <td><strong>Scope:</strong> ${report.scope.level}</td>
          <td><strong>Generated:</strong> ${report.generatedAt}</td>
        </tr>
        ${report.scope.user ? `<tr><td colspan="2"><strong>User:</strong> ${report.scope.user}</td></tr>` : ""}
        ${dateRangeText}
      </table>

      <table class="data-table">
        <thead>
          <tr>
            ${report.data.headers.map((h) => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${dataRows}
          ${summaryRows}
        </tbody>
      </table>

      <div class="footer">
        <p>Report Page ${report.pageInfo?.currentPage || 1}${report.pageInfo?.totalPages ? ` of ${report.pageInfo.totalPages}` : ""}</p>
        <p>${report.company?.name ? report.company.name + " - " : ""}Confidential</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Converts report layout to CSV format
 */
export function reportLayoutToCsv(report: ProfessionalReportLayout): string {
  const lines: string[] = [];

  // Header info
  lines.push(`"${report.title}"`);
  if (report.subtitle) lines.push(`"${report.subtitle}"`);
  lines.push(`"${report.company.name}"`);
  lines.push("");

  // Metadata
  lines.push(`"Scope","${report.scope.level}"`);
  lines.push(`"Generated","${report.generatedAt}"`);
  if (report.scope.user) lines.push(`"User","${report.scope.user}"`);
  if (report.dateRange) {
    lines.push(
      `"Period","${report.dateRange.from} to ${report.dateRange.to}"`
    );
  }
  lines.push("");

  // Data headers
  lines.push(report.data.headers.map((h) => `"${h}"`).join(","));

  // Data rows
  for (const row of report.data.rows) {
    lines.push(row.map((cell) => `"${cell}"`).join(","));
  }

  // Summary
  if (report.data.summary) {
    lines.push("");
    for (const [key, value] of Object.entries(report.data.summary)) {
      lines.push(`"${key}","${value}"`);
    }
  }

  lines.push("");
  lines.push(`"Generated: ${report.generatedAt}"`);

  return lines.join("\n");
}

/**
 * Converts report layout to Excel-compatible HTML table
 */
export function reportLayoutToExcelHtml(
  report: ProfessionalReportLayout
): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  return `
    <html xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 4px; }
        th { background-color: #f0f0f0; }
        .header { font-weight: bold; font-size: 14px; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="header">${report.title}</div>
      <table>
        <tr>
          <td colspan="2"><strong>Company:</strong> ${report.company.name}</td>
        </tr>
        <tr>
          <td><strong>Scope:</strong> ${report.scope.level}</td>
          <td><strong>Generated:</strong> ${report.generatedAt}</td>
        </tr>
        ${report.dateRange ? `<tr><td colspan="2"><strong>Period:</strong> ${report.dateRange.from} to ${report.dateRange.to}</td></tr>` : ""}
      </table>
      <br/>
      <table>
        <thead>
          <tr>
            ${report.data.headers.map((h) => `<th>${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${report.data.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
          ${
            report.data.summary
              ? `<tr>
              ${Object.entries(report.data.summary)
                .map(
                  ([key, value]) =>
                    `<td><strong>${key}</strong></td><td><strong>${value}</strong></td>`
                )
                .join("")}
            </tr>`
              : ""
          }
        </tbody>
      </table>
    </body>
    </html>
  `;
}
