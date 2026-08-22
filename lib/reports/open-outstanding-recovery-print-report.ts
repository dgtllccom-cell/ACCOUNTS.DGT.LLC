import { escapeHtml, formatMoney, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";

export type OutstandingRecoveryPrintRow = {
  srNo: number;
  accountName: string;
  accountCode?: string;
  branchAndCountry: string;
  outstandingAmount: number;
  currency?: string;
  agingStatus: string;
  daysOutstanding?: number;
  lastTransactionDate: string;
  recoveryStatus: "Pending" | "In Recovery" | "Cleared" | string;
};

export type OutstandingRecoveryPrintSummary = {
  outstandingAccounts: number;
  totalReceivable: number;
  totalPayable: number;
  netOutstanding: number;
  overdue10Count: number;
  totalEntries: number;
  clearedEntries: number;
  remainingEntries: number;
  activeCountriesCount: number;
  totalBranchesCount: number;
  statusText?: string;
  coverageText?: string;
};

export type OutstandingRecoveryPrintInput = {
  rows: OutstandingRecoveryPrintRow[];
  summary: OutstandingRecoveryPrintSummary;
  scope?: {
    country?: string;
    branch?: string;
    currency?: string;
    userName?: string;
    role?: string;
  };
  companyInfo?: ERPCompanyInfo;
  autoPrint?: boolean;
  lang?: string;
};

export function openOutstandingRecoveryPrintReport(input: OutstandingRecoveryPrintInput) {
  if (typeof window === "undefined") return;

  const {
    rows,
    summary,
    scope = {},
    companyInfo = {},
    autoPrint = true,
    lang = "en"
  } = input;

  const targetLang = (lang || (typeof document !== "undefined" ? (localStorage.getItem("erp_lang") || document.documentElement.lang || "en") : "en")) as "en" | "ur" | "ar" | "fa" | "ps";
  const tr = (str: string) => {
    if (!str || str === "-") return str;
    const res = autoTranslate5Languages(str);
    return res[targetLang] || str;
  };

  const orgName = companyInfo.name || "DAMAAN GENERAL TRADING LLC";
  const logoText = "DIGITAL DOCK ERP";
  const address = companyInfo.address || "Operating Address: Office 402, Business Bay, Dubai, United Arab Emirates";
  const trnNumber = "TRN: 100458923400003";
  const emailContact = companyInfo.email || "accounts@dgt.llc | support@dgt.llc";

  const printDate = new Date();
  const printDateFormatted = printDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const printTimeFormatted = printDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  const fullDateTime = `${printDateFormatted}, ${printTimeFormatted}`;

  const userName = scope.userName || companyInfo.printedBy || "ERP USER (Super Admin)";
  const countryName = scope.country || "All Countries";
  const branchName = scope.branch || "ALL BRANCHES";
  const baseCurrency = scope.currency || "AED";

  const totalOutstandingSum = rows.reduce((sum, r) => sum + Number(r.outstandingAmount || 0), 0);

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(targetLang)}" dir="${["ur", "ar", "fa", "ps"].includes(targetLang) ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <title>${tr("Outstanding & Recovery Ledger Report")} - ${escapeHtml(printDateFormatted)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 15mm 10mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
      }
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 8.5pt;
      line-height: 1.35;
      color: #1e293b;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .no-print {
      display: block;
    }

    @media print {
      .no-print {
        display: none !important;
      }
      body {
        margin: 0;
        padding: 0;
      }
      thead {
        display: table-header-group;
      }
      tr {
        page-break-inside: avoid;
      }
    }

    .toolbar {
      background: #0f172a;
      color: #ffffff;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    .toolbar button {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .toolbar button:hover {
      background: #1d4ed8;
    }
    .toolbar button.close-btn {
      background: #475569;
    }

    .report-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 12px 15px;
    }

    /* ── 1. HEADER SECTION ──────────────────────────────── */
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 14pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 8pt;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .brand-meta {
      font-size: 7.5pt;
      color: #475569;
      margin-top: 2px;
      line-height: 1.3;
    }
    .doc-title-block {
      text-align: right;
    }
    .doc-title {
      font-size: 12pt;
      font-weight: 900;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .doc-meta {
      font-size: 7.5pt;
      color: #475569;
      margin-top: 3px;
      line-height: 1.4;
    }
    .doc-scope-pill {
      display: inline-block;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 800;
      color: #0f172a;
      font-size: 7pt;
      margin-top: 3px;
    }

    /* ── 2. SUMMARY METRIC CARDS GRID ───────────────────── */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .summary-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      padding: 7px 9px;
      font-size: 7.5pt;
    }
    .summary-card-header {
      font-size: 7.5pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding-bottom: 4px;
      margin-bottom: 5px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .card-blue .summary-card-header { color: #1e40af; }
    .card-emerald .summary-card-header { color: #047857; }
    .card-purple .summary-card-header { color: #6b21a8; }
    .card-amber .summary-card-header { color: #b45309; }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3px;
    }
    .summary-row:last-child {
      margin-bottom: 0;
    }
    .summary-label {
      color: #64748b;
      font-weight: 600;
    }
    .summary-val {
      font-weight: 800;
      color: #0f172a;
      font-family: monospace;
    }
    .highlight-net {
      border-top: 1px dashed #cbd5e1;
      padding-top: 4px;
      margin-top: 4px;
      font-weight: 900;
      color: #1e3a8a;
    }

    /* ── 3. DATA TABLE SPECIFICATION ────────────────────── */
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.8pt;
      margin-bottom: 12px;
    }
    .ledger-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 7pt;
      letter-spacing: 0.4px;
      padding: 5px 6px;
      border: 1px solid #0f172a;
      text-align: left;
    }
    .ledger-table td {
      padding: 5px 6px;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      vertical-align: middle;
    }
    .ledger-table tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .ledger-table tbody tr:hover {
      background-color: #f1f5f9;
    }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .text-left { text-align: left !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .font-bold { font-weight: 800; }

    .status-badge {
      display: inline-block;
      padding: 1.5px 5px;
      border-radius: 3px;
      font-size: 6.5pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .status-overdue {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #f87171;
    }
    .status-active {
      background: #dbeafe;
      color: #1e40af;
      border: 1px solid #93c5fd;
    }
    .status-cleared {
      background: #d1fae5;
      color: #065f46;
      border: 1px solid #6ee7b7;
    }
    .status-recovery {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fcd34d;
    }

    .totals-row {
      background: #e2e8f0 !important;
      font-weight: 900;
      border-top: 2px solid #0f172a;
    }
    .totals-row td {
      border: 1px solid #94a3b8;
      padding: 6px;
      font-size: 8pt;
    }

    /* ── 4. FOOTER SPECIFICATION ────────────────────────── */
    .page-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7pt;
      color: #64748b;
    }
  </style>
</head>
<body>

  <!-- Screen Only Toolbar -->
  <div class="toolbar no-print">
    <div style="font-weight: 800; font-size: 13px;">
      🖨️ ${tr("Outstanding & Recovery Ledger - A4 Print Preview")}
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()">
        <span>🖨️</span> ${tr("Print / Save as PDF")}
      </button>
      <button class="close-btn" onclick="window.close()">
        ${tr("Close")}
      </button>
    </div>
  </div>

  <div class="report-container">
    
    <!-- ── 1. HEADER SECTION ─────────────────────────────── -->
    <table class="header-table">
      <tr>
        <td style="width: 55%; vertical-align: top;">
          <div class="brand-title">${escapeHtml(orgName)}</div>
          <div class="brand-sub">${escapeHtml(logoText)}</div>
          <div class="brand-meta">
            ${escapeHtml(address)}<br />
            <strong>${escapeHtml(trnNumber)}</strong> | ${escapeHtml(emailContact)}
          </div>
        </td>
        <td style="width: 45%; vertical-align: top;" class="doc-title-block">
          <div class="doc-title">${tr("OUTSTANDING & RECOVERY LEDGER REPORT")}</div>
          <div class="doc-meta">
            <strong>${tr("Generated By")}:</strong> ${escapeHtml(userName)}<br />
            <strong>${tr("Generated Date & Time")}:</strong> ${escapeHtml(fullDateTime)}<br />
            <span class="doc-scope-pill">
              ${tr("Reporting Scope")}: ${tr("Country")}: ${escapeHtml(countryName)} | ${tr("Branch")}: ${escapeHtml(branchName)} | ${tr("Base Currency")}: ${escapeHtml(baseCurrency)}
            </span>
          </div>
        </td>
      </tr>
    </table>

    <!-- ── 2. SUMMARY METRICS 4-COLUMN COMPACT PRINT GRID ── -->
    <div class="summary-grid">
      
      <!-- Card 1: Summary Metrics -->
      <div class="summary-card card-blue">
        <div class="summary-card-header">
          <span>📊 ${tr("Summary Metrics")}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Outstanding Accounts")}:</span>
          <span class="summary-val">${summary.outstandingAccounts}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Overdue Accounts (>10 Days)")}:</span>
          <span class="summary-val" style="color: #dc2626;">${summary.overdue10Count}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Status")}:</span>
          <span class="summary-val" style="color: #059669;">${escapeHtml(summary.statusText || "Session Active")}</span>
        </div>
      </div>

      <!-- Card 2: Financial Totals -->
      <div class="summary-card card-emerald">
        <div class="summary-card-header">
          <span>💰 ${tr("Financial Totals")} (${escapeHtml(baseCurrency)})</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Total Receivable")}:</span>
          <span class="summary-val" style="color: #059669;">${formatMoney(summary.totalReceivable)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Total Payable")}:</span>
          <span class="summary-val" style="color: #d97706;">${formatMoney(summary.totalPayable)}</span>
        </div>
        <div class="summary-row highlight-net">
          <span class="summary-label" style="font-weight: 800; color: #1e3a8a;">${tr("Net Outstanding")}:</span>
          <span class="summary-val" style="color: #1e3a8a;">${formatMoney(summary.netOutstanding)}</span>
        </div>
      </div>

      <!-- Card 3: Bill Status Summary -->
      <div class="summary-card card-purple">
        <div class="summary-card-header">
          <span>📋 ${tr("Bill Status Summary")}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Total Entries")}:</span>
          <span class="summary-val">${summary.totalEntries}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Cleared Entries")}:</span>
          <span class="summary-val" style="color: #059669;">${summary.clearedEntries}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Remaining Entries")}:</span>
          <span class="summary-val" style="color: #d97706;">${summary.remainingEntries}</span>
        </div>
      </div>

      <!-- Card 4: Coverage Info -->
      <div class="summary-card card-amber">
        <div class="summary-card-header">
          <span>🌐 ${tr("Coverage Info")}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Active Countries")}:</span>
          <span class="summary-val">${summary.activeCountriesCount}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Total Branches")}:</span>
          <span class="summary-val">${summary.totalBranchesCount}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Coverage")}:</span>
          <span class="summary-val" style="color: #2563eb;">${escapeHtml(summary.coverageText || "Global Network")}</span>
        </div>
      </div>

    </div>

    <!-- ── 3. DETAILED DATA TABLE ────────────────────────── -->
    <table class="ledger-table">
      <thead>
        <tr>
          <th class="text-center" style="width: 5%;">${tr("SR #")}</th>
          <th style="width: 25%;">${tr("Account / Customer Name")}</th>
          <th style="width: 18%;">${tr("Branch & Country")}</th>
          <th class="text-right" style="width: 15%;">${tr("Total Outstanding")} (${escapeHtml(baseCurrency)})</th>
          <th class="text-center" style="width: 12%;">${tr("Aging Status")}</th>
          <th class="text-center" style="width: 13%;">${tr("Last Transaction Date")}</th>
          <th class="text-center" style="width: 12%;">${tr("Recovery Status")}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length > 0 ? rows.map((r) => {
          const isOverdue = (r.daysOutstanding ?? 0) > 10 || r.agingStatus?.toLowerCase().includes("overdue");
          const agingBadgeClass = isOverdue ? "status-overdue" : "status-active";
          const agingLabel = isOverdue ? `Overdue (${r.daysOutstanding || ">10"} Days)` : `0–10 Days (${r.daysOutstanding || 7}d)`;

          const recStatus = r.recoveryStatus || (r.outstandingAmount === 0 ? "Cleared" : isOverdue ? "In Recovery" : "Pending");
          const recBadgeClass = recStatus.toLowerCase().includes("cleared")
            ? "status-cleared"
            : recStatus.toLowerCase().includes("recovery")
            ? "status-recovery"
            : "status-active";

          return `
            <tr>
              <td class="text-center font-mono font-bold">${r.srNo}</td>
              <td>
                <div class="font-bold">${escapeHtml(r.accountName)}</div>
                ${r.accountCode ? `<div style="font-size: 6.5pt; color: #64748b; font-family: monospace;">${escapeHtml(r.accountCode)}</div>` : ""}
              </td>
              <td>${escapeHtml(r.branchAndCountry)}</td>
              <td class="text-right font-mono font-bold" style="color: ${r.outstandingAmount > 0 ? '#047857' : r.outstandingAmount < 0 ? '#b91c1c' : '#475569'};">
                ${formatMoney(Math.abs(r.outstandingAmount))}
              </td>
              <td class="text-center">
                <span class="status-badge ${agingBadgeClass}">${escapeHtml(tr(agingLabel))}</span>
              </td>
              <td class="text-center font-mono">${escapeHtml(formatDate(r.lastTransactionDate))}</td>
              <td class="text-center">
                <span class="status-badge ${recBadgeClass}">${escapeHtml(tr(recStatus))}</span>
              </td>
            </tr>
          `;
        }).join("") : `
          <tr>
            <td colspan="7" class="text-center" style="padding: 20px; color: #64748b;">${tr("No outstanding accounts found for the selected scope.")}</td>
          </tr>
        `}
      </tbody>
      <tfoot>
        <tr class="totals-row">
          <td colspan="3" class="text-left font-bold" style="text-transform: uppercase;">
            ${tr("Grand Totals")} (${rows.length} ${tr("Accounts")})
          </td>
          <td class="text-right font-mono font-bold" style="color: #1e3a8a; font-size: 8.5pt;">
            ${formatMoney(Math.abs(totalOutstandingSum))} ${escapeHtml(baseCurrency)}
          </td>
          <td colspan="3" class="text-center" style="font-size: 7pt; color: #475569;">
            ${tr("Calculated from all active outstanding ledger records")}
          </td>
        </tr>
      </tfoot>
    </table>

    <!-- ── 4. STANDARDIZED PAGE FOOTER ───────────────────── -->
    <div class="page-footer">
      <div>${escapeHtml(orgName)} • ${tr("Outstanding & Recovery Ledger")} • ${escapeHtml(fullDateTime)}</div>
      <div>${tr("Page")} 1 of 1 — <strong>${tr("Confidential ERP Report")}</strong></div>
    </div>

  </div>

  ${autoPrint ? `
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 400);
    });
  </script>
  ` : ""}
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to open the print preview.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
