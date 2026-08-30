import { escapeHtml, formatMoney, type ERPCompanyInfo } from "./erp-report-template-builder";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";

export type OutstandingRecoveryPrintRow = {
  srNo: number;
  accountName: string;
  accountCode?: string;
  accountType?: string;
  branchAndCountry: string;
  currency?: string;
  debit?: number;
  credit?: number;
  outstandingAmount: number;
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
    sessionStatus?: string;
    filterType?: string;
    dateRange?: string;
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
    autoPrint = false,
    lang = "en"
  } = input;

  const targetLang = (lang || (typeof document !== "undefined" ? (localStorage.getItem("erp_lang") || document.documentElement.lang || "en") : "en")) as "en" | "ur" | "ar" | "fa" | "ps";
  const tr = (str: string) => {
    if (!str || str === "-") return str;
    const res = autoTranslate5Languages(str);
    return res[targetLang] || str;
  };

  const isRtl = ["ur", "ar", "fa", "ps"].includes(targetLang);

  const orgName = companyInfo.name || "";
  const logoText = "DIGITAL DOCK ERP";
  const address = companyInfo.address || "";
  const trnNumber = (companyInfo as any).taxNo || "";
  const emailContact = companyInfo.email || "";

  const printDate = new Date();
  const printDateFormatted = printDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const printTimeFormatted = printDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  const fullDateTime = `${printDateFormatted}, ${printTimeFormatted}`;

  const userName = scope.userName || companyInfo.printedBy || "ERP User";
  const countryName = scope.country || "All Countries";
  const branchName = scope.branch || "ALL BRANCHES";
  const baseCurrency = scope.currency || "AED";
  const activeSessionStatus = summary.statusText || scope.sessionStatus || "Session Active";
  const activeFilterName = scope.filterType || "All Outstanding Records";
  const dateRange = scope.dateRange || "All Available Dates (2026)";

  const totalOutstandingSum = rows.reduce((sum, r) => sum + Number(r.outstandingAmount || 0), 0);
  const totalDebitSum = rows.reduce((sum, r) => sum + Number(r.debit || 0), 0);
  const totalCreditSum = rows.reduce((sum, r) => sum + Number(r.credit || 0), 0);

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(targetLang)}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <title>${tr("Outstanding & Recovery Ledger Report")} - ${escapeHtml(printDateFormatted)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

    @page {
      size: A4 landscape;
      margin: 8mm 8mm 12mm 8mm;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: ${isRtl ? "'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif" : "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
      font-size: 7.2pt;
      line-height: 1.3;
      color: #0f172a;
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
        width: 100% !important;
      }
      .report-container {
        padding: 0 !important;
        max-width: none !important;
        width: 100% !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      tr, .summary-card, .meta-filter-box {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }

    .toolbar {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      font-size: 11px;
    }
    .toolbar button {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 6px 12px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .toolbar button.secondary-btn {
      background: #334155;
    }
    .toolbar button.close-btn {
      background: #64748b;
    }

    .report-container {
      max-width: 1300px;
      margin: 0 auto;
      padding: 8px 12px;
    }

    /* ── 1. HEADER SECTION ──────────────────────────────── */
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 5px;
      margin-bottom: 8px;
    }
    .brand-title {
      font-size: 12pt;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 7.2pt;
      color: #2563eb;
      font-weight: 800;
      text-transform: uppercase;
    }
    .brand-meta {
      font-size: 6.8pt;
      color: #475569;
      margin-top: 1px;
      line-height: 1.25;
    }
    .doc-title-block {
      text-align: ${isRtl ? "left" : "right"};
    }
    .doc-title {
      font-size: 12pt;
      font-weight: 900;
      color: #1e3a8a;
      text-transform: uppercase;
    }
    .doc-meta {
      font-size: 6.8pt;
      color: #475569;
      margin-top: 2px;
      line-height: 1.3;
    }

    /* ── 2. ACTIVE FILTER CONTEXT BAR ──────────────────── */
    .meta-filter-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 5px 8px;
      margin-bottom: 8px;
      font-size: 6.8pt;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .meta-filter-box strong { color: #0f172a; }

    /* ── 3. SUMMARY METRIC CARDS GRID ───────────────────── */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 8px;
    }
    .summary-card {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #ffffff;
      padding: 6px 8px;
      font-size: 7pt;
    }
    .summary-card-header {
      font-size: 6.8pt;
      font-weight: 900;
      text-transform: uppercase;
      padding-bottom: 3px;
      margin-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    .card-blue .summary-card-header { color: #1e40af; }
    .card-emerald .summary-card-header { color: #047857; }
    .card-purple .summary-card-header { color: #6b21a8; }
    .card-amber .summary-card-header { color: #b45309; }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2px;
    }
    .summary-label {
      color: #64748b;
      font-weight: 700;
    }
    .summary-val {
      font-weight: 900;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    /* ── 4. GRANULAR FINANCIAL DATA TABLE ────────────────── */
    .ledger-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7pt;
      margin-bottom: 8px;
    }
    .ledger-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 6.3pt;
      letter-spacing: 0.3px;
      padding: 4px 5px;
      border: 1px solid #0f172a;
      text-align: ${isRtl ? "right" : "left"};
    }
    .ledger-table td {
      padding: 3.5px 5px;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      vertical-align: middle;
    }
    .ledger-table tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .text-left { text-align: left !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .font-bold { font-weight: 800; }
    .dr-text { color: #991b1b !important; }
    .cr-text { color: #065f46 !important; }

    .status-badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 6.2pt;
      font-weight: 800;
      text-transform: uppercase;
    }
    .badge-overdue { background: #fee2e2; color: #991b1b; }
    .badge-normal { background: #e0f2fe; color: #0369a1; }
    .badge-cleared { background: #dcfce7; color: #15803d; }
    .badge-pending { background: #fef3c7; color: #b45309; }

    .totals-row {
      background: #e2e8f0 !important;
      font-weight: 900;
      border-top: 2px solid #0f172a;
    }
    .totals-row td {
      border: 1px solid #94a3b8;
      padding: 4px 5px;
      font-size: 7.3pt;
    }

    .page-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 3px;
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.2pt;
      color: #64748b;
    }
  </style>
</head>
<body>

  <!-- Screen Toolbar -->
  <div class="toolbar no-print">
    <div style="font-weight: 800; font-size: 12px; display: flex; align-items: center; gap: 6px;">
      <span>🖨️</span> ${tr("Outstanding & Recovery Ledger - A4 Print Preview")} [<span id="orient-label">LANDSCAPE</span>]
    </div>
    <div style="display: flex; gap: 8px; align-items: center;">
      <button onclick="window.print()">
        <span>📄</span> ${tr("Print / Save as PDF")}
      </button>
      <button class="secondary-btn" onclick="toggleOrientation()">
        <span>🔄</span> <span id="toggle-label">${tr("Switch to Portrait")}</span>
      </button>
      <button class="close-btn" onclick="window.close()">
        ${tr("Close")}
      </button>
    </div>
  </div>

  <div class="report-container" id="report-container">
    
    <!-- ── 1. HEADER SECTION ─────────────────────────────── -->
    <table class="header-table">
      <tr>
        <td style="width: 55%; vertical-align: top;">
          <div class="brand-title">${escapeHtml(orgName)}</div>
          <div class="brand-sub">${escapeHtml(logoText)}</div>
          <div class="brand-meta">
            ${address ? `${escapeHtml(address)}<br />` : ""}
            ${[trnNumber ? `<strong>${escapeHtml(trnNumber)}</strong>` : "", escapeHtml(emailContact)].filter(Boolean).join(" | ")}
          </div>
        </td>
        <td style="width: 45%; vertical-align: top;" class="doc-title-block">
          <div class="doc-title">${tr("OUTSTANDING & RECOVERY LEDGER REPORT")}</div>
          <div class="doc-meta">
            <strong>${tr("Generated By")}:</strong> ${escapeHtml(userName)}<br />
            <strong>${tr("Generated Date & Time")}:</strong> ${escapeHtml(fullDateTime)}<br />
            <strong>${tr("Session Status")}:</strong> <span style="color:#059669; font-weight:800;">${escapeHtml(activeSessionStatus)}</span>
          </div>
        </td>
      </tr>
    </table>

    <!-- ── 2. ACTIVE FILTER CONTEXT BAR ──────────────────── -->
    <div class="meta-filter-box">
      <div><strong>${tr("Report Filter")}:</strong> ${escapeHtml(activeFilterName)}</div>
      <div><strong>${tr("Date Range")}:</strong> ${escapeHtml(dateRange)}</div>
      <div><strong>${tr("Country / Branch")}:</strong> ${escapeHtml(countryName)} • ${escapeHtml(branchName)}</div>
      <div><strong>${tr("Reporting Currency")}:</strong> ${escapeHtml(baseCurrency)}</div>
    </div>

    <!-- ── 3. SUMMARY METRICS 4-COLUMN COMPACT PRINT GRID ── -->
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
          <span class="summary-label">${tr("Overdue (>10 Days)")}:</span>
          <span class="summary-val" style="color: #dc2626;">${summary.overdue10Count}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Session Status")}:</span>
          <span class="summary-val" style="color: #059669;">${escapeHtml(activeSessionStatus)}</span>
        </div>
      </div>

      <!-- Card 2: Financial Totals -->
      <div class="summary-card card-emerald">
        <div class="summary-card-header">
          <span>💰 ${tr("Financial Totals")} (${escapeHtml(baseCurrency)})</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Total Receivable")}:</span>
          <span class="summary-val dr-text">${formatMoney(summary.totalReceivable)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">${tr("Total Payable")}:</span>
          <span class="summary-val cr-text">${formatMoney(summary.totalPayable)}</span>
        </div>
        <div class="summary-row">
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
          <span class="summary-val">${summary.remainingEntries}</span>
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

    <!-- ── 4. GRANULAR FINANCIAL DATA TABLE ────────────────── -->
    <table class="ledger-table">
      <thead>
        <tr>
          <th style="width: 4%;" class="text-center">#</th>
          <th style="width: 20%;">${tr("Account / Customer Name")}</th>
          <th style="width: 10%;">${tr("Account Type")}</th>
          <th style="width: 14%;">${tr("Branch & Country")}</th>
          <th style="width: 7%;" class="text-center">${tr("Currency")}</th>
          <th style="width: 9%;" class="text-right">${tr("Debit (DR)")}</th>
          <th style="width: 9%;" class="text-right">${tr("Credit (CR)")}</th>
          <th style="width: 11%;" class="text-right">${tr("Total Outstanding")}</th>
          <th style="width: 8%;" class="text-center">${tr("Aging Status")}</th>
          <th style="width: 8%;" class="text-center">${tr("Last Tx Date")}</th>
          <th style="width: 7%;" class="text-center">${tr("Status")}</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length > 0 ? rows.map(r => {
          const isOverdue = (r.agingStatus || "").toLowerCase().includes("overdue") || (r.daysOutstanding && r.daysOutstanding > 10);
          const isCleared = (r.recoveryStatus || "").toLowerCase() === "cleared";

          return `
          <tr>
            <td class="text-center font-mono font-bold">${r.srNo}</td>
            <td>
              <div class="font-bold" style="color: #0f172a;">${escapeHtml(r.accountName)}</div>
              ${r.accountCode ? `<div class="font-mono" style="font-size: 6pt; color: #64748b;">${escapeHtml(r.accountCode)}</div>` : ""}
            </td>
            <td>${escapeHtml(r.accountType || "Customer")}</td>
            <td>${escapeHtml(r.branchAndCountry)}</td>
            <td class="text-center font-mono font-bold">${escapeHtml(r.currency || baseCurrency)}</td>
            <td class="text-right font-mono font-bold dr-text">${formatMoney(r.debit || 0)}</td>
            <td class="text-right font-mono font-bold cr-text">${formatMoney(r.credit || 0)}</td>
            <td class="text-right font-mono font-bold" style="color: #1e3a8a;">${formatMoney(r.outstandingAmount)} ${baseCurrency}</td>
            <td class="text-center">
              <span class="status-badge ${isOverdue ? 'badge-overdue' : 'badge-normal'}">
                ${escapeHtml(r.agingStatus)}
              </span>
            </td>
            <td class="text-center font-mono" style="font-size: 6.5pt;">${escapeHtml(r.lastTransactionDate || "-")}</td>
            <td class="text-center">
              <span class="status-badge ${isCleared ? 'badge-cleared' : 'badge-pending'}">
                ${escapeHtml(r.recoveryStatus)}
              </span>
            </td>
          </tr>
          `;
        }).join("") : `
          <tr>
            <td colspan="11" class="text-center" style="padding: 16px; color: #64748b;">
              ${tr("No outstanding ledger records found for the selected scope.")}
            </td>
          </tr>
        `}
      </tbody>
      ${rows.length > 0 ? `
      <tfoot>
        <tr class="totals-row">
          <td colspan="5" class="text-left font-bold" style="text-transform: uppercase;">
            ${tr("Grand Totals")} (${rows.length} ${tr("Accounts")})
          </td>
          <td class="text-right font-mono font-bold dr-text">${formatMoney(totalDebitSum)}</td>
          <td class="text-right font-mono font-bold cr-text">${formatMoney(totalCreditSum)}</td>
          <td class="text-right font-mono font-bold" style="color: #1e3a8a;">${formatMoney(totalOutstandingSum)} ${baseCurrency}</td>
          <td colspan="3" class="text-center" style="font-size: 6.5pt; color: #475569;">
            ${tr("Calculated from all active outstanding ledger records")}
          </td>
        </tr>
      </tfoot>
      ` : ""}
    </table>

    <!-- ── 5. STANDARDIZED PAGE FOOTER ───────────────────── -->
    <div class="page-footer">
      <div>${escapeHtml(orgName)} • ${tr("Outstanding & Recovery Ledger")} • ${escapeHtml(fullDateTime)}</div>
      <div>${tr("Page")} 1 of 1 — <strong>${tr("Confidential ERP Report")}</strong></div>
    </div>

  </div>

  <script>
    function toggleOrientation() {
      const styleEl = document.querySelector('style');
      const containerEl = document.getElementById('report-container');
      const orientLabel = document.getElementById('orient-label');
      const toggleLabel = document.getElementById('toggle-label');

      const isCurrentlyLandscape = styleEl.innerHTML.includes('size: A4 landscape');
      const newOrientation = isCurrentlyLandscape ? 'portrait' : 'landscape';
      
      styleEl.innerHTML = styleEl.innerHTML.replace(/size: A4 (portrait|landscape)/, 'size: A4 ' + newOrientation);
      if (containerEl) {
        containerEl.style.maxWidth = newOrientation === 'landscape' ? '1300px' : '980px';
      }
      if (orientLabel) {
        orientLabel.innerText = newOrientation.toUpperCase();
      }
      if (toggleLabel) {
        toggleLabel.innerText = newOrientation === 'landscape' ? '${tr("Switch to Portrait")}' : '${tr("Switch to Landscape")}';
      }
    }

    ${autoPrint ? `
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 400);
    });
    ` : ""}
  </script>
</body>
</html>`;

  // Prefer in-app PDF preview modal
  try {
    const { printStore } = require("@/lib/store/print-store");
    printStore.openPrint(html, tr("Outstanding & Recovery Ledger Report"));
    return;
  } catch (e) {
    console.warn("Could not open in printStore, using fallback", e);
  }

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
