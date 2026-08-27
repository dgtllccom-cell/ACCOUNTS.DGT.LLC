/* eslint-disable @typescript-eslint/no-explicit-any */
import { escapeHtml, formatMoney, formatNumber, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";
import { autoTranslate5Languages } from "@/lib/i18n/multilingual-translator";
import { printStore } from "@/lib/store/print-store";

export type PrintModuleType = 
  | "ledger" 
  | "journal"
  | "roznamcha"
  | "sales_invoice" 
  | "purchase_procurement" 
  | "inventory" 
  | "shipping"
  | "hr_payroll" 
  | "custom"
  | "register";

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
  reportType?: "single_document" | "register";
  orientation?: "portrait" | "landscape" | "auto";
  
  // Scope / Metadata
  scope?: {
    dateRange?: string;
    country?: string;
    branch?: string;
    currency?: string;
    userName?: string;
    role?: string;
    company?: string;
    scopeLevel?: string;
  };
  
  // Company & Branding (General Brand Tier 1 + Operating Entity Tier 2)
  companyInfo?: ERPCompanyInfo;
  generalBrand?: {
    name?: string;
    logoUrl?: string;
    tagline?: string;
    address?: string;
    contact?: string;
    taxNo?: string;
  };
  
  // Summary Metric Cards
  kpis?: UniversalPrintKpi[];
  filters?: UniversalPrintFilter[];
  
  // Billing / Entity Details (for Invoices, GRNs, Salary Slips, etc.)
  partyDetails?: {
    type: "customer" | "supplier" | "employee" | "branch" | "entity";
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
    generalBrand = {},
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
    autoPrint = false,
    lang = "en"
  } = input;

  // Auto-detect orientation: if columns > 7 or total width exceeds portrait, default to landscape
  const effectiveOrientation: "portrait" | "landscape" =
    input.orientation === "landscape" || (input.orientation !== "portrait" && columns.length > 7)
      ? "landscape"
      : "portrait";

  const targetLang = (lang || (typeof document !== "undefined" ? (localStorage.getItem("erp_lang") || document.documentElement.lang || "en") : "en")) as "en" | "ur" | "ar" | "fa" | "ps";
  
  const tr = (str: string) => {
    if (!str || str === "-") return str;
    const res = autoTranslate5Languages(str);
    return res[targetLang] || str;
  };

  const isRtl = ["ur", "ar", "fa", "ps"].includes(targetLang);

  // Two-Tier Branding: General Brand (Tier 1) + Operating Entity (Tier 2)
  const brandName = generalBrand.name || "DAMAAN GENERAL TRADING LLC";
  const brandTagline = generalBrand.tagline || "GLOBAL ENTERPRISE MANAGEMENT SYSTEM";
  const brandAddress = generalBrand.address || companyInfo.address || "Operating Address: Office 402, Business Bay, Dubai, United Arab Emirates";
  const brandTaxNo = generalBrand.taxNo || "TRN: 100458923400003";
  const brandContact = generalBrand.contact || companyInfo.email || "accounts@dgt.llc | support@dgt.llc";

  const entityName = scope.company || companyInfo.name || brandName;
  const countryName = scope.country || "Global Scope";
  const branchName = scope.branch || "All Branches";
  const baseCurrency = scope.currency || "USD";
  const dateRange = scope.dateRange || "All Available Records";

  const printDate = new Date();
  const printDateFormatted = printDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const printTimeFormatted = printDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  const fullDateTime = `${printDateFormatted}, ${printTimeFormatted}`;
  const userName = scope.userName || companyInfo.printedBy || "ERP User";

  const qrPayload = `ERP|${entityName}|${title}|${documentNo || "DOC"}|${fullDateTime}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrPayload)}`;

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(targetLang)}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - ${escapeHtml(printDateFormatted)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

    @page {
      size: A4 ${effectiveOrientation};
      margin: 8mm 8mm 12mm 8mm;
      @bottom-right {
        content: "${tr("Page")} " counter(page) " ${tr("of")} " counter(pages);
        font-size: 7pt;
        color: #64748b;
      }
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: ${isRtl ? "'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif" : "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
      font-size: 8pt;
      line-height: 1.35;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      position: relative;
    }

    .watermark-bg {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 72pt;
      font-weight: 900;
      color: rgba(15, 23, 42, 0.03);
      pointer-events: none;
      z-index: 0;
      text-transform: uppercase;
      white-space: nowrap;
      user-select: none;
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
      .report-container {
        padding: 0 !important;
        max-width: none !important;
        width: 100% !important;
      }
      table.report-table {
        page-break-inside: auto !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      tr, .summary-card, .meta-box, .signature-block, .terms-box {
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
    .toolbar-actions {
      display: flex;
      gap: 8px;
      align-items: center;
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
      transition: background 0.15s;
    }
    .toolbar button:hover {
      background: #1d4ed8;
    }
    .toolbar button.secondary-btn {
      background: #334155;
    }
    .toolbar button.secondary-btn:hover {
      background: #475569;
    }
    .toolbar button.close-btn {
      background: #64748b;
    }

    .report-container {
      max-width: ${effectiveOrientation === "landscape" ? "1350px" : "980px"};
      margin: 0 auto;
      padding: 10px 14px;
      position: relative;
      z-index: 1;
    }

    /* ── 1. TWO-TIER BRAND & TITLE HEADER ──────────────── */
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .brand-title {
      font-size: 13pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.3px;
      text-transform: uppercase;
    }
    .brand-tagline {
      font-size: 7.5pt;
      color: #2563eb;
      font-weight: 800;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      margin-top: 1px;
    }
    .brand-meta {
      font-size: 7pt;
      color: #475569;
      margin-top: 2px;
      line-height: 1.25;
    }
    .doc-title-block {
      text-align: ${isRtl ? "left" : "right"};
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
      font-size: 7pt;
      color: #475569;
      margin-top: 3px;
      line-height: 1.35;
    }
    .doc-scope-pill {
      display: inline-block;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 800;
      color: #0f172a;
      font-size: 6.8pt;
      margin-top: 3px;
    }
    .qr-badge {
      width: 44px;
      height: 44px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      padding: 2px;
      background: #ffffff;
      display: inline-block;
      vertical-align: middle;
      margin-inline-start: 8px;
    }

    /* ── 2. METADATA & PARTY BOXES ─────────────────────── */
    .meta-boxes-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }
    .meta-box {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 6px 8px;
      background: #f8fafc;
      font-size: 7.2pt;
    }
    .meta-box-header {
      font-weight: 900;
      text-transform: uppercase;
      color: #1e3a8a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
      margin-bottom: 3px;
      font-size: 7.2pt;
    }

    /* ── 3. SUMMARY KPI METRIC CARDS ───────────────────── */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 6px;
      margin-bottom: 10px;
    }
    .summary-card {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #f8fafc;
      padding: 5px 7px;
      font-size: 7.2pt;
    }
    .card-label {
      color: #64748b;
      font-weight: 700;
      font-size: 6.5pt;
      text-transform: uppercase;
    }
    .card-val {
      font-size: 10.5pt;
      font-weight: 900;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      margin-top: 2px;
    }

    /* ── 4. DATA TABLE ─────────────────────────────────── */
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      margin-bottom: 10px;
    }
    .report-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 6.8pt;
      letter-spacing: 0.3px;
      padding: 5px 6px;
      border: 1px solid #0f172a;
      text-align: ${isRtl ? "right" : "left"};
    }
    .report-table td {
      padding: 4px 6px;
      border: 1px solid #cbd5e1;
      color: #1e293b;
      vertical-align: middle;
    }
    .report-table tbody tr:nth-child(even) {
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
      padding: 5px 6px;
      font-size: 7.8pt;
    }

    /* ── 5. TERMS & SIGNATURES ─────────────────────────── */
    .terms-box {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 6px 8px;
      background: #f8fafc;
      font-size: 7pt;
      margin-bottom: 12px;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 20px;
      margin-bottom: 12px;
    }
    .signature-block {
      text-align: center;
      border-top: 1px solid #475569;
      padding-top: 4px;
      font-size: 7pt;
    }
    .signature-title {
      font-weight: 800;
      color: #0f172a;
    }
    .signature-sub {
      color: #64748b;
      font-size: 6.2pt;
      margin-top: 1px;
    }

    /* ── 6. PAGE FOOTER ────────────────────────────────── */
    .page-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 5px;
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.8pt;
      color: #64748b;
    }
  </style>
</head>
<body>

  <div class="watermark-bg">${escapeHtml(brandName)}</div>

  <!-- Screen Only Toolbar -->
  <div class="toolbar no-print">
    <div style="font-weight: 800; font-size: 12px; display: flex; align-items: center; gap: 6px;">
      <span>🖨️</span> ${escapeHtml(title)} [${effectiveOrientation.toUpperCase()}]
    </div>
    <div class="toolbar-actions">
      <button onclick="window.print()">
        <span>📄</span> ${tr("Print / Save as PDF")}
      </button>
      <button class="secondary-btn" onclick="toggleOrientation()">
        <span>🔄</span> ${effectiveOrientation === 'landscape' ? tr("Portrait") : tr("Landscape")}
      </button>
      <button class="close-btn" onclick="window.close()">
        ${tr("Close")}
      </button>
    </div>
  </div>

  <div class="report-container">
    
    <!-- ── 1. TWO-TIER HEADER ────────────────────────────── -->
    <table class="header-table">
      <tr>
        <td style="width: 55%; vertical-align: top;">
          <div class="brand-title">${escapeHtml(brandName)}</div>
          <div class="brand-tagline">${escapeHtml(brandTagline)}</div>
          <div class="brand-meta">
            ${escapeHtml(brandAddress)}<br />
            <strong>${escapeHtml(brandTaxNo)}</strong> | ${escapeHtml(brandContact)}<br />
            <strong>${tr("Operating Entity")}:</strong> ${escapeHtml(entityName)}
          </div>
        </td>
        <td style="width: 45%; vertical-align: top;" class="doc-title-block">
          <div style="display: inline-flex; align-items: center; gap: 8px;">
            <div>
              <div class="doc-title">${escapeHtml(title)}</div>
              ${subtitle ? `<div class="doc-subtitle">${escapeHtml(subtitle)}</div>` : ""}
            </div>
            <img class="qr-badge" src="${qrUrl}" alt="QR Verification" />
          </div>
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

    <!-- ── 2. METADATA & PARTY SUMMARY ───────────────────── -->
    ${partyDetails || filters.length > 0 ? `
    <div class="meta-boxes-grid">
      ${partyDetails ? `
      <div class="meta-box">
        <div class="meta-box-header">
          📋 ${partyDetails.type === "customer" ? tr("Customer / Buyer Details") : partyDetails.type === "supplier" ? tr("Supplier / Vendor Details") : partyDetails.type === "employee" ? tr("Employee Details") : tr("Entity Details")}
        </div>
        <div style="font-weight: 800; font-size: 8pt; color: #0f172a;">${escapeHtml(partyDetails.name)}</div>
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

    <!-- ── 3. SUMMARY KPI CARDS ──────────────────────────── -->
    ${kpis.length > 0 ? `
    <div class="summary-grid">
      ${kpis.map(k => `
      <div class="summary-card">
        <div class="card-label">${escapeHtml(tr(k.label))}</div>
        <div class="card-val">${typeof k.value === "number" ? formatMoney(k.value) : escapeHtml(String(k.value))}</div>
      </div>
      `).join("")}
    </div>
    ` : ""}

    <!-- ── 4. DATA TABLE ─────────────────────────────────── -->
    <table class="report-table">
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
            <td colspan="${columns.length}" class="text-center" style="padding: 16px; color: #64748b;">
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

    <!-- ── 5. TERMS & BANK DETAILS ───────────────────────── -->
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
      <div>${escapeHtml(brandName)} • ${escapeHtml(title)} • ${escapeHtml(fullDateTime)}</div>
      <div>${tr("Page")} 1 of 1 — <strong>${tr("Confidential ERP Report")}</strong></div>
    </div>

  </div>

  <script>
    function toggleOrientation() {
      const styleEl = document.querySelector('style');
      const isCurrentlyLandscape = styleEl.innerHTML.includes('size: A4 landscape');
      const newOrientation = isCurrentlyLandscape ? 'portrait' : 'landscape';
      styleEl.innerHTML = styleEl.innerHTML.replace(/size: A4 (portrait|landscape)/, 'size: A4 ' + newOrientation);
      document.querySelector('.report-container').style.maxWidth = newOrientation === 'landscape' ? '1350px' : '980px';
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

  // Prefer in-app PDF Preview Modal for seamless UX with zero popup blocker issues
  try {
    printStore.openPrint(html, title || "ERP Report");
    return;
  } catch (e) {
    console.warn("Could not open in printStore, falling back to window.open", e);
  }

  // Fallback: Try window.open
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    return;
  }

  // Final fallback: append hidden iframe
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 500);
    }
  } catch (e) {
    console.error("Print invocation failed:", e);
  }
}

