import { escapeHtml, formatMoney, formatNumber, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";

export type PrintModuleType = 
  | "ledger" 
  | "sales_invoice" 
  | "purchase_procurement" 
  | "inventory" 
  | "hr_payroll" 
  | "custom";

export type UniversalPrintColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  width?: string;
  format?: "currency" | "number" | "date" | "badge" | "text";
};

export type UniversalPrintKpi = {
  label: string;
  value: string | number;
  color?: "blue" | "emerald" | "purple" | "amber" | "red" | "slate";
};

export type UniversalPrintFilter = {
  label: string;
  value: string;
};

export type UniversalPrintInput = {
  moduleType?: PrintModuleType;
  title: string;
  subtitle?: string;
  documentNo?: string;
  
  // Scope / Metadata
  scope?: {
    dateRange?: string;
    country?: string;
    branch?: string;
    currency?: string;
    userName?: string;
    role?: string;
  };
  
  // Company & Branding
  companyInfo?: ERPCompanyInfo;
  
  // Summary Metric Cards
  kpis?: UniversalPrintKpi[];
  filters?: UniversalPrintFilter[];
  
  // Billing / Entity Details (for Invoices, GRNs, Salary Slips, etc.)
  partyDetails?: {
    type: "customer" | "supplier" | "employee" | "branch";
    name: string;
    code?: string;
    address?: string;
    trn?: string;
    phone?: string;
    email?: string;
    departmentOrBranch?: string;
    designationOrContact?: string;
  };
  
  // Main Data Table
  columns: UniversalPrintColumn[];
  rows: Record<string, any>[];
  totals?: Record<string, string | number>;
  
  // Footer, Terms & Signatures
  paymentTerms?: string;
  bankDetails?: string;
  notes?: string;
  showSignatures?: boolean;
  signatureBlocks?: Array<{ title: string; subtitle?: string }>;
  
  // Execution
  autoPrint?: boolean;
  lang?: string;
};

export function openUniversalPrintReport(input: UniversalPrintInput) {
  if (typeof window === "undefined") return;

  const {
    moduleType = "custom",
    title,
    subtitle,
    documentNo,
    scope = {},
    companyInfo = {},
    kpis = [],
    filters = [],
    partyDetails,
    columns,
    rows,
    totals,
    paymentTerms,
    bankDetails,
    notes,
    showSignatures = ["sales_invoice", "purchase_procurement", "hr_payroll"].includes(moduleType),
    signatureBlocks = [
      { title: "Prepared By", subtitle: "Signature & Stamp" },
      { title: "Verified & Audited", subtitle: "Accounts Department" },
      { title: "Authorized Signature", subtitle: "Chief Executive / Director" }
    ],
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
  const dateRange = scope.dateRange || "All Available Records";

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(targetLang)}" dir="${["ur", "ar", "fa", "ps"].includes(targetLang) ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - ${escapeHtml(printDateFormatted)}</title>
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
        width: 100% !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      thead {
        display: table-header-group !important;
      }
      tr {
        page-break-inside: avoid !important;
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

    /* ── 1. STANDARDIZED HEADER ─────────────────────────── */
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
      font-size: 13pt;
      font-weight: 900;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .doc-subtitle {
      font-size: 8pt;
      font-weight: 700;
      color: #475569;
      margin-top: 1px;
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

    /* ── 2. FILTER & PARTY DETAILS ──────────────────────── */
    .meta-boxes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }
    .meta-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
      font-size: 7.5pt;
    }
    .meta-box-header {
      font-weight: 900;
      text-transform: uppercase;
      color: #1e3a8a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
      margin-bottom: 4px;
      font-size: 7.5pt;
    }

    /* ── 3. SUMMARY METRIC CARDS ────────────────────────── */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .summary-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      padding: 6px 8px;
      font-size: 7.5pt;
    }
    .card-label {
      color: #64748b;
      font-weight: 700;
      font-size: 7pt;
      text-transform: uppercase;
    }
    .card-val {
      font-size: 11pt;
      font-weight: 900;
      color: #0f172a;
      font-family: monospace;
      margin-top: 2px;
    }

    /* ── 4. MAIN DATA TABLE ─────────────────────────────── */
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
    .text-center { text-align: center !important; }
    .text-right { text-align: right !important; }
    .text-left { text-align: left !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .font-bold { font-weight: 800; }

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

    /* ── 5. TERMS & SIGNATURES ──────────────────────────── */
    .terms-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
      font-size: 7.5pt;
      margin-bottom: 15px;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 25px;
      margin-bottom: 15px;
    }
    .signature-block {
      text-align: center;
      border-top: 1px solid #475569;
      padding-top: 5px;
      font-size: 7.5pt;
    }
    .signature-title {
      font-weight: 800;
      color: #0f172a;
    }
    .signature-sub {
      color: #64748b;
      font-size: 6.5pt;
      margin-top: 1px;
    }

    /* ── 6. PAGE FOOTER ─────────────────────────────────── */
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
      🖨️ ${escapeHtml(title)} - ${tr("Print Preview")}
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
          <div class="doc-title">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="doc-subtitle">${escapeHtml(subtitle)}</div>` : ""}
          <div class="doc-meta">
            ${documentNo ? `<strong>${tr("Document No")}:</strong> ${escapeHtml(documentNo)}<br />` : ""}
            <strong>${tr("Generated By")}:</strong> ${escapeHtml(userName)}<br />
            <strong>${tr("Generated Date & Time")}:</strong> ${escapeHtml(fullDateTime)}<br />
            <span class="doc-scope-pill">
              ${tr("Scope")}: ${escapeHtml(countryName)} | ${escapeHtml(branchName)} | ${escapeHtml(baseCurrency)}
            </span>
          </div>
        </td>
      </tr>
    </table>

    <!-- ── 2. PARTY / METADATA SUMMARY ────────────────────── -->
    ${partyDetails || filters.length > 0 ? `
    <div class="meta-boxes-grid">
      ${partyDetails ? `
      <div class="meta-box">
        <div class="meta-box-header">
          📋 ${partyDetails.type === "customer" ? tr("Customer / Buyer Details") : partyDetails.type === "supplier" ? tr("Supplier / Vendor Details") : partyDetails.type === "employee" ? tr("Employee Details") : tr("Entity Details")}
        </div>
        <div style="font-weight: 800; font-size: 8.5pt; color: #0f172a;">${escapeHtml(partyDetails.name)}</div>
        ${partyDetails.code ? `<div style="font-family: monospace; color: #64748b;">${escapeHtml(partyDetails.code)}</div>` : ""}
        ${partyDetails.address ? `<div>${escapeHtml(partyDetails.address)}</div>` : ""}
        ${partyDetails.trn ? `<div><strong>TRN:</strong> ${escapeHtml(partyDetails.trn)}</div>` : ""}
        ${partyDetails.phone || partyDetails.email ? `<div>${escapeHtml(partyDetails.phone || "")} ${partyDetails.email ? `| ${escapeHtml(partyDetails.email)}` : ""}</div>` : ""}
      </div>
      ` : `<div></div>`}

      <div class="meta-box">
        <div class="meta-box-header">
          ⚙️ ${tr("Reporting Parameters & Filter Summary")}
        </div>
        <div><strong>${tr("Date Range")}:</strong> ${escapeHtml(dateRange)}</div>
        <div><strong>${tr("Operating Branch")}:</strong> ${escapeHtml(branchName)} (${escapeHtml(countryName)})</div>
        <div><strong>${tr("Currency")}:</strong> ${escapeHtml(baseCurrency)}</div>
        ${filters.map(f => `<div><strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.value)}</div>`).join("")}
      </div>
    </div>
    ` : ""}

    <!-- ── 3. SUMMARY KPI METRIC CARDS ────────────────────── -->
    ${kpis.length > 0 ? `
    <div class="summary-grid">
      ${kpis.map(k => `
      <div class="summary-card">
        <div class="card-label">${escapeHtml(tr(k.label))}</div>
        <div class="card-val">${typeof k.value === "number" ? formatMoney(k.value) : escapeHtml(k.value)}</div>
      </div>
      `).join("")}
    </div>
    ` : ""}

    <!-- ── 4. DATA TABLE ─────────────────────────────────── -->
    <table class="ledger-table">
      <thead>
        <tr>
          ${columns.map(c => `
            <th class="${c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : 'text-left'}" ${c.width ? `style="width: ${c.width};"` : ""}>
              ${escapeHtml(tr(c.label))}
            </th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.length > 0 ? rows.map(r => `
          <tr>
            ${columns.map(c => {
              const val = r[c.key];
              let displayVal = val;
              if (c.format === "currency") displayVal = formatMoney(val);
              else if (c.format === "number") displayVal = formatNumber(val);
              else if (c.format === "date") displayVal = formatDate(val);
              else if (val === null || val === undefined) displayVal = "-";

              return `
                <td class="${c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : 'text-left'} ${c.format === 'currency' || c.format === 'number' ? 'font-mono font-bold' : ''}">
                  ${escapeHtml(String(displayVal))}
                </td>
              `;
            }).join("")}
          </tr>
        `).join("") : `
          <tr>
            <td colspan="${columns.length}" class="text-center" style="padding: 20px; color: #64748b;">
              ${tr("No records found for this report.")}
            </td>
          </tr>
        `}
      </tbody>
      ${totals && Object.keys(totals).length > 0 ? `
      <tfoot>
        <tr class="totals-row">
          ${columns.map((c, i) => {
            const totVal = totals[c.key];
            if (i === 0 && !totVal) {
              return `<td class="text-left font-bold" style="text-transform: uppercase;">${tr("Grand Totals")}</td>`;
            }
            return `
              <td class="${c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : 'text-left'} font-mono font-bold">
                ${totVal !== undefined ? (typeof totVal === "number" || c.format === "currency" ? formatMoney(totVal) : escapeHtml(String(totVal))) : ""}
              </td>
            `;
          }).join("")}
        </tr>
      </tfoot>
      ` : ""}
    </table>

    <!-- ── 5. PAYMENT TERMS & BANK DETAILS ───────────────── -->
    ${paymentTerms || bankDetails || notes ? `
    <div class="terms-box">
      ${paymentTerms ? `<div><strong>${tr("Payment Terms")}:</strong> ${escapeHtml(paymentTerms)}</div>` : ""}
      ${bankDetails ? `<div><strong>${tr("Bank & Wire Details")}:</strong> ${escapeHtml(bankDetails)}</div>` : ""}
      ${notes ? `<div><strong>${tr("Special Notes / Remarks")}:</strong> ${escapeHtml(notes)}</div>` : ""}
    </div>
    ` : ""}

    <!-- ── 6. SIGNATURE BLOCKS ───────────────────────────── -->
    ${showSignatures ? `
    <div class="signature-grid">
      ${signatureBlocks.map(s => `
      <div class="signature-block">
        <div class="signature-title">${escapeHtml(tr(s.title))}</div>
        ${s.subtitle ? `<div class="signature-sub">${escapeHtml(tr(s.subtitle))}</div>` : ""}
      </div>
      `).join("")}
    </div>
    ` : ""}

    <!-- ── 7. STANDARDIZED PAGE FOOTER ───────────────────── -->
    <div class="page-footer">
      <div>${escapeHtml(orgName)} • ${escapeHtml(title)} • ${escapeHtml(fullDateTime)}</div>
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
