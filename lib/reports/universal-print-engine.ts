/* eslint-disable @typescript-eslint/no-explicit-any */
import { escapeHtml, formatMoney, formatNumber, formatDate, type ERPCompanyInfo } from "./erp-report-template-builder";
import { qrCodeSvgMarkup } from "@/components/ui/qr-code";
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

  // Explicit Ledger Summary Metadata
  ledgerSummary?: {
    accountName?: string;
    accountCode?: string;
    accountOpenDate?: string;
    currency?: string;
    status?: string;
    manualReference?: string;
    customerReference?: string;
    accountType?: string;
    taxNo?: string;
    companyName?: string;
    countryName?: string;
    mainBranch?: string;
    cityBranch?: string;
    branchCode?: string;
    address?: string;
    openingBalance?: number;
    openingDcType?: "Dr" | "Cr";
    totalDebit?: number;
    totalCredit?: number;
    closingBalance?: number;
    closingDcType?: "Dr" | "Cr";
    datePeriod?: string;
    countryBranch?: string;
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
  const html = buildUniversalPrintHtml(input);

  // Prefer in-app PDF Preview Modal for seamless UX with zero popup blocker issues
  try {
    printStore.openPrint(html, input.title || "Account Ledger Statement");
    return;
  } catch (e) {
    console.warn("Could not open in printStore, falling back to window.open", e);
  }
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

/** Pure HTML builder — safe to call server-side / in tests (no window access). */
export function buildUniversalPrintHtml(input: UniversalPrintInput): string {
  const {
    moduleType = "custom",
    title,
    subtitle,
    documentNo,
    scope = {},
    ledgerSummary,
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
    showSignatures = ["sales_invoice", "purchase_procurement", "hr_payroll", "ledger"].includes(moduleType),
    signatureBlocks = [
      { title: "Prepared By", subtitle: "Signature & Stamp" },
      { title: "Verified & Audited", subtitle: "Accounts Department" },
      { title: "Authorized Signature", subtitle: "Chief Executive / Director" }
    ],
    autoPrint = false,
    lang = "en"
  } = input;

  const isLedger = moduleType === "ledger";
  // Only ledger / journal / roznamcha / invoice / procurement reports get the
  // accounting framing (account-meta bar, Dr/Cr balance strip, FC-LC + double-entry
  // footer). Registers, lists, HR, shipping, CRM, tasks, inquiries etc. must NOT
  // inherit that accounting boilerplate.
  const isFinancial =
    ["ledger", "journal", "roznamcha", "sales_invoice", "purchase_procurement"].includes(moduleType) ||
    Boolean(ledgerSummary && (ledgerSummary.accountCode || ledgerSummary.openingBalance != null || ledgerSummary.closingBalance != null));

  // Auto-detect orientation
  const effectiveOrientation: "portrait" | "landscape" =
    input.orientation === "portrait"
      ? "portrait"
      : input.orientation === "landscape" || columns.length > 8
      ? "landscape"
      : "portrait";

  const targetLang = (lang || (typeof document !== "undefined" ? ((typeof localStorage !== "undefined" && localStorage.getItem("erp_lang")) || document.documentElement.lang || "en") : "en")) as "en" | "ur" | "ar" | "fa" | "ps";
  
  const tr = (str: string) => {
    if (!str || str === "-") return str;
    const res = autoTranslate5Languages(str);
    return res[targetLang] || str;
  };

  const isRtl = ["ur", "ar", "fa", "ps"].includes(targetLang);

  // Dynamic Hierarchy Branding Resolution: Selected Ledger -> Company -> Country -> Main Branch / City Branch
  const resolvedCompanyName = ledgerSummary?.companyName || scope.company || companyInfo.name || generalBrand.name;
  const resolvedCountry = ledgerSummary?.countryName || scope.country || "Global Scope";
  const resolvedBranch = ledgerSummary?.cityBranch || ledgerSummary?.mainBranch || scope.branch || "Main Branch";
  // Tax / registration number comes ONLY from the entity's branding record — never fabricated per country.
  const resolvedTaxNo = String(ledgerSummary?.taxNo || (companyInfo as any).taxNo || generalBrand.taxNo || "").trim();
  // Ignore configuration-placeholder strings ("Configured contact", "N/A", "None", "-", …)
  // that occasionally get typed into the company/brand record.
  const realOrEmpty = (v: unknown): string => {
    const s = String(v ?? "").trim();
    if (!s || /^(configured\b|n\/?a$|none$|null$|undefined$|-+$|tbd$|todo$|placeholder\b|not\s+set$|not\s+configured$)/i.test(s)) return "";
    return s;
  };
  const resolvedAddress = realOrEmpty(ledgerSummary?.address) || realOrEmpty(companyInfo.address) || realOrEmpty(generalBrand.address) || `${resolvedBranch}, ${resolvedCountry}`;
  const resolvedContact = realOrEmpty(companyInfo.email) || realOrEmpty((companyInfo as any).phone) || realOrEmpty(generalBrand.contact) || "";

  const brandName = resolvedCompanyName
    || (resolvedCountry !== "Global Scope" ? `${resolvedCountry.toUpperCase()} OPERATING ENTITY` : (isFinancial ? "ERP ACCOUNTING STATEMENT" : "DIGITAL DOCK ERP"));
  const brandTagline = generalBrand.tagline || `${resolvedBranch.toUpperCase()} NETWORK • ${resolvedCountry.toUpperCase()}`;
  const entityName = resolvedCompanyName || brandName;
  const baseCurrency = ledgerSummary?.currency || scope.currency || "AED";
  const dateRange = ledgerSummary?.datePeriod || scope.dateRange || "All Available Records";

  const printDate = new Date();
  const printDateFormatted = printDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const printTimeFormatted = printDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  const fullDateTime = `${printDateFormatted}, ${printTimeFormatted}`;
  const userName = realOrEmpty(scope.userName) || realOrEmpty(companyInfo.printedBy)
    || (typeof window !== "undefined" ? realOrEmpty((window as unknown as { __ERP_USER_NAME__?: string }).__ERP_USER_NAME__) : "")
    || "";

  // ── presentation-layer value normalisation (QA: raw ISO dates, snake_case
  //    transaction types, lowercase currency codes shown to users) ──────────
  const CURRENCY_RE = /^[a-z]{3}$/;
  const ISO_DT_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  const humanizeToken = (s: string) =>
    s.replace(/[_\s]+/g, " ")
      .replace(/\b(\w)(\w*)/g, (_m, a: string, b: string) => a.toUpperCase() + b)
      .replace(/\b(Po|So|Grn|Kyc|Fx|Trn|Iban|Vat|Hs)\b/g, (m) => m.toUpperCase());
  const normalizeCell = (raw: unknown, col: UniversalPrintColumn): string => {
    let s = String(raw ?? "").trim();
    if (!s || s === "-") return s || "-";
    if (col.format === "currency" || col.format === "number" || col.format === "date" || col.format === "badge") return s;
    if (CURRENCY_RE.test(s)) return s.toUpperCase();                                  // usd -> USD
    if (ISO_DT_RE.test(s)) { const d = formatDate(s); if (d && d !== s) return d; }    // 2025-10-15T00:00:00Z -> 15 Oct 2025
    if (/^[a-z]+(?:_[a-z0-9]+){1,}$/i.test(s) && /_/.test(s)) return humanizeToken(s); // purchase_order_advance_payment -> Purchase Order Advance Payment
    return s;
  };

  // Financial summary calculations for Ledgers
  const openBal = ledgerSummary?.openingBalance ?? Number(totals?.openingBalance ?? 0);
  const openDc = ledgerSummary?.openingDcType || (openBal >= 0 ? "Dr" : "Cr");
  const totalDr = ledgerSummary?.totalDebit ?? Number(totals?.debit ?? totals?.totalDebit ?? 0);
  const totalCr = ledgerSummary?.totalCredit ?? Number(totals?.credit ?? totals?.totalCredit ?? 0);
  const closeBal = ledgerSummary?.closingBalance ?? Number(totals?.runningBalance ?? totals?.balance ?? totals?.closingBalance ?? (openBal + totalDr - totalCr));
  const closeDc = ledgerSummary?.closingDcType || (closeBal >= 0 ? "Dr" : "Cr");

  const qrPayload = `ERP|${entityName}|${title}|${documentNo || "LEDGER"}|${fullDateTime}`;
  // Inline pure-SVG QR — no external network call, so Print / PDF is offline-safe.
  const qrSvg = qrCodeSvgMarkup(qrPayload, { size: 100 });

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(targetLang)}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - ${escapeHtml(printDateFormatted)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;600;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

    @page {
      size: A4 ${effectiveOrientation};
      margin: 6mm 6mm 10mm 6mm;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: ${isRtl ? "'Noto Naskh Arabic', 'Segoe UI', Tahoma, Arial, sans-serif" : "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"};
      font-size: 7.2pt;
      line-height: 1.28;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      position: relative;
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
      tr, .financial-summary-strip, .signature-block, .account-meta-box {
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
      padding: 8px 10px;
      position: relative;
      z-index: 1;
    }

    /* ── 1. DYNAMIC ERP HEADER ──────────────────────────── */
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .brand-title {
      font-size: 11.5pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.2px;
      text-transform: uppercase;
    }
    .brand-tagline {
      font-size: 6.8pt;
      color: #2563eb;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .brand-meta {
      font-size: 6.5pt;
      color: #475569;
      margin-top: 1px;
      line-height: 1.2;
    }
    .doc-title-block {
      text-align: ${isRtl ? "left" : "right"};
    }
    .doc-title {
      font-size: 11.5pt;
      font-weight: 900;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .doc-subtitle {
      font-size: 7.8pt;
      font-weight: 800;
      color: #0f172a;
      margin-top: 1px;
    }
    .doc-meta {
      font-size: 6.5pt;
      color: #475569;
      margin-top: 2px;
      line-height: 1.25;
    }
    .qr-badge {
      width: 38px;
      height: 38px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      padding: 1px;
      background: #ffffff;
      display: inline-block;
      vertical-align: middle;
    }
    .qr-badge svg { display: block; width: 100%; height: 100%;
      margin-inline-start: 6px;
    }

    /* ── 2. ACCOUNT DETAILS & METADATA GRID ────────────── */
    .account-meta-box {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 5px 8px;
      background: #ffffff;
      margin-bottom: 6px;
      font-size: 6.8pt;
    }
    .account-meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px 8px;
      line-height: 1.35;
    }
    .meta-item {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta-item strong {
      color: #475569;
      font-weight: 700;
    }
    .meta-item span {
      color: #0f172a;
      font-weight: 800;
    }

    /* ── 2b. KPI SUMMARY CARDS (print-safe: light border, no bg dependency) ── */
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 5px;
      margin-bottom: 6px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 4px 8px;
      background: #f8fafc;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .kpi-card-label {
      font-size: 5.8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #64748b;
    }
    .kpi-card-val {
      font-size: 11pt;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.1;
      margin-top: 1px;
    }
    .kpi-card.b { border-inline-start: 3px solid #2563eb; }
    .kpi-card.emerald { border-inline-start: 3px solid #059669; }
    .kpi-card.amber { border-inline-start: 3px solid #d97706; }
    .kpi-card.red { border-inline-start: 3px solid #dc2626; }
    .kpi-card.purple { border-inline-start: 3px solid #7c3aed; }
    .kpi-card.slate { border-inline-start: 3px solid #475569; }
    .filter-strip {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 3px 8px;
      margin-bottom: 6px;
      font-size: 6.4pt;
      color: #475569;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
    }
    .filter-strip strong { color: #0f172a; font-weight: 800; }

    /* ── 3. FINANCIAL SUMMARY STRIP (4-COLUMN COMPACT) ──── */
    .financial-summary-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px;
      margin-bottom: 6px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 5px 8px;
    }
    .summary-box {
      font-size: 6.5pt;
    }
    .summary-box-label {
      color: #64748b;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 6pt;
      letter-spacing: 0.2px;
    }
    .summary-box-val {
      font-size: 9pt;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #0f172a;
      margin-top: 1px;
    }
    .dr-text { color: #991b1b !important; }
    .cr-text { color: #065f46 !important; }
    .net-text { color: #1e3a8a !important; }
    .dc-badge {
      font-size: 7pt;
      font-weight: 900;
      margin-inline-start: 2px;
    }

    /* ── 4. ACCOUNTING LEDGER DATA TABLE ──────────────── */
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7pt;
      margin-bottom: 6px;
    }
    .report-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 6.2pt;
      letter-spacing: 0.2px;
      padding: 3.5px 4px;
      border: 1px solid #0f172a;
      text-align: ${isRtl ? "right" : "left"};
    }
    .report-table td {
      padding: 3px 4px;
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
      padding: 3.5px 4px;
      font-size: 7.2pt;
    }

    /* ── 5. COMPACT SIGNATURES & FOOTER ───────────────── */
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-top: 10px;
      margin-bottom: 6px;
    }
    .signature-block {
      text-align: center;
      border-top: 1px solid #475569;
      padding-top: 2px;
      font-size: 6.5pt;
    }
    .signature-title {
      font-weight: 800;
      color: #0f172a;
    }
    .signature-sub {
      color: #64748b;
      font-size: 5.8pt;
    }

    .page-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 3px;
      margin-top: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.2pt;
      color: #64748b;
    }
  </style>
</head>
<body>

  <!-- Screen-only toolbar — only for the standalone window.open() fallback.
       Inside PdfPreviewModal (an iframe) the modal already provides Print /
       orientation / Close, so this one is hidden to avoid a duplicate bar. -->
  <script>try{if(window.self!==window.top){document.documentElement.classList.add('in-modal');}}catch(e){document.documentElement.classList.add('in-modal');}</script>
  <style>.in-modal .toolbar{display:none !important;}</style>
  <div class="toolbar no-print no-print-toolbar">
    <div style="font-weight: 800; font-size: 12px; display: flex; align-items: center; gap: 6px;">
      <span>🖨️</span> ${escapeHtml(title)} [<span id="orient-label">${effectiveOrientation.toUpperCase()}</span>]
    </div>
    <div class="toolbar-actions">
      <button onclick="window.print()">
        <span>📄</span> ${tr("Print / Save as PDF")}
      </button>
      <button class="secondary-btn" onclick="toggleOrientation()">
        <span>🔄</span> <span id="toggle-label">${effectiveOrientation === 'landscape' ? tr("Switch to Portrait") : tr("Switch to Landscape")}</span>
      </button>
      <button class="close-btn" onclick="window.close()">
        ${tr("Close")}
      </button>
    </div>
  </div>

  <div class="report-container" id="report-container">
    
    <!-- ── 1. DYNAMIC ERP HEADER ────────────────────────────── -->
    <table class="header-table">
      <tr>
        <td style="width: 50%; vertical-align: top;">
          <div class="brand-title">${escapeHtml(brandName)}</div>
          <div class="brand-tagline">${escapeHtml(brandTagline)}</div>
          <div class="brand-meta">
            ${escapeHtml(resolvedAddress)}<br />
            ${[resolvedTaxNo ? `<strong>${escapeHtml(resolvedTaxNo)}</strong>` : "", escapeHtml(resolvedContact)].filter(Boolean).join(" | ")}${(resolvedTaxNo || resolvedContact) ? "<br />" : ""}
            <strong>${tr("Operating Entity")}:</strong> ${escapeHtml(entityName)}
          </div>
        </td>
        <td style="width: 50%; vertical-align: top;" class="doc-title-block">
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <div>
              <div class="doc-title">${escapeHtml(title)}</div>
              <div class="doc-subtitle">${escapeHtml(ledgerSummary?.accountName || partyDetails?.name || subtitle || (isFinancial ? "Account Statement" : ""))}</div>
            </div>
            <span class="qr-badge">${qrSvg}</span>
          </div>
          <div class="doc-meta">
            ${(ledgerSummary?.accountCode || partyDetails?.code || documentNo)
              ? `<strong>${tr(isFinancial ? "Account Code" : "Reference")}:</strong> ${escapeHtml(ledgerSummary?.accountCode || partyDetails?.code || documentNo || "")}<br />`
              : ""}
            <strong>${tr("Country / Branch")}:</strong> ${escapeHtml(resolvedCountry)} • ${escapeHtml(resolvedBranch)}<br />
            <strong>${tr("Currency / Period")}:</strong> ${escapeHtml(baseCurrency)} | ${escapeHtml(dateRange)}<br />
            <strong>${tr("Generated")}:</strong> ${escapeHtml(fullDateTime)}${userName ? ` (${escapeHtml(userName)})` : ""}
          </div>
        </td>
      </tr>
    </table>

    <!-- ── 2a. KPI SUMMARY CARDS (all report types) ─────────── -->
    ${kpis.length > 0 ? `
    <div class="kpi-strip">
      ${kpis.map(k => `
        <div class="kpi-card ${k.color === 'blue' ? 'b' : (k.color || 'slate')}">
          <div class="kpi-card-label">${escapeHtml(tr(String(k.label)))}</div>
          <div class="kpi-card-val">${escapeHtml(String(k.value))}</div>
        </div>
      `).join("")}
    </div>` : ""}

    <!-- ── 2b. ACTIVE FILTERS (all report types) ─────────────── -->
    ${filters.length > 0 ? `
    <div class="filter-strip">
      ${filters.map(f => `<span><strong>${escapeHtml(tr(String(f.label)))}:</strong> ${escapeHtml(String(f.value))}</span>`).join("")}
    </div>` : ""}

    <!-- ── 2. FULL SELECTED LEDGER REAL METADATA BAR (accounting reports only) -->
    ${isFinancial ? `
    <div class="account-meta-box">
      <div class="account-meta-grid">
        <div class="meta-item"><strong>${tr("Account Code")}:</strong> <span>${escapeHtml(ledgerSummary?.accountCode || partyDetails?.code || "-")}</span></div>
        <div class="meta-item"><strong>${tr("Account Name")}:</strong> <span>${escapeHtml(ledgerSummary?.accountName || partyDetails?.name || "-")}</span></div>
        <div class="meta-item"><strong>${tr("Open Date")}:</strong> <span>${escapeHtml(ledgerSummary?.accountOpenDate || "-")}</span></div>
        <div class="meta-item"><strong>${tr("Currency")}:</strong> <span>${escapeHtml(baseCurrency)}</span></div>
        <div class="meta-item"><strong>${tr("Status")}:</strong> <span style="color:#059669;">${escapeHtml(ledgerSummary?.status || "Active")}</span></div>
        <div class="meta-item"><strong>${tr("Manual Ref")}:</strong> <span>${escapeHtml(ledgerSummary?.manualReference || "-")}</span></div>
        <div class="meta-item"><strong>${tr("Customer / Party Ref")}:</strong> <span>${escapeHtml(ledgerSummary?.customerReference || partyDetails?.code || "-")}</span></div>
        <div class="meta-item"><strong>${tr("Account Type")}:</strong> <span>${escapeHtml(ledgerSummary?.accountType || "Standard Ledger")}</span></div>
        <div class="meta-item"><strong>${tr("Country")}:</strong> <span>${escapeHtml(resolvedCountry)}</span></div>
        <div class="meta-item"><strong>${tr("Main Branch")}:</strong> <span>${escapeHtml(ledgerSummary?.mainBranch || resolvedBranch)}</span></div>
        <div class="meta-item"><strong>${tr("City Branch")}:</strong> <span>${escapeHtml(ledgerSummary?.cityBranch || resolvedBranch)}</span></div>
        <div class="meta-item"><strong>${tr("Branch Code")}:</strong> <span>${escapeHtml(ledgerSummary?.branchCode || "-")}</span></div>
      </div>
    </div>` : ""}

    <!-- ── 3. FINANCIAL SUMMARY STRIP (4-COLUMN BOX, accounting reports only) -->
    ${isFinancial ? `
    <div class="financial-summary-strip">
      <div class="summary-box">
        <div class="summary-box-label">${tr("Opening Balance")}</div>
        <div class="summary-box-val">${formatMoney(openBal)} <span class="dc-badge ${openDc === 'Dr' ? 'dr-text' : 'cr-text'}">${openDc}</span></div>
      </div>
      <div class="summary-box">
        <div class="summary-box-label">${tr("Total Debit (DR)")}</div>
        <div class="summary-box-val dr-text">${formatMoney(totalDr)}</div>
      </div>
      <div class="summary-box">
        <div class="summary-box-label">${tr("Total Credit (CR)")}</div>
        <div class="summary-box-val cr-text">${formatMoney(totalCr)}</div>
      </div>
      <div class="summary-box">
        <div class="summary-box-label">${tr("Closing / Net Balance")}</div>
        <div class="summary-box-val net-text">${formatMoney(Math.abs(closeBal))} <span class="dc-badge ${closeDc === 'Dr' ? 'dr-text' : 'cr-text'}">${closeDc}</span></div>
      </div>
    </div>` : ""}

    <!-- ── 4. MAIN DATA TABLE ──────────────────────────────── -->
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
              
              // Custom Multi-Currency Column Handling
              if (c.key === "currencyExRate" || c.key === "exchangeRateInfo") {
                if (r.origCurrency && r.origCurrency !== baseCurrency) {
                  displayVal = `${r.origCurrency} ${formatMoney(r.origAmount || 0)} (@ ${r.exchangeRate || r.usdRate || 1})`;
                } else {
                  displayVal = baseCurrency;
                }
              } else if (c.format === "currency") {
                displayVal = formatMoney(val);
              } else if (c.format === "number") {
                displayVal = formatNumber(val);
              } else if (c.format === "date") {
                displayVal = formatDate(val);
              } else if (val === null || val === undefined) {
                displayVal = "-";
              } else {
                displayVal = normalizeCell(val, c);
              }

              const isDebitCol = c.key.toLowerCase().includes("debit") || c.key === "dr";
              const isCreditCol = c.key.toLowerCase().includes("credit") || c.key === "cr";
              const isBalanceCol = c.key.toLowerCase().includes("balance");

              let colorClass = "";
              if (isDebitCol && Number(val) > 0) colorClass = "dr-text";
              else if (isCreditCol && Number(val) > 0) colorClass = "cr-text";

              return `
                <td class="${c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : 'text-left'} ${c.format === 'currency' || c.format === 'number' || isBalanceCol ? 'font-mono font-bold' : ''} ${colorClass}">
                  ${escapeHtml(String(displayVal))}
                  ${isBalanceCol && r.dcType ? ` <span class="${r.dcType === 'Dr' ? 'dr-text' : 'cr-text'}" style="font-size:6.2pt;">${r.dcType}</span>` : ""}
                </td>
              `;
            }).join("")}
          </tr>
        `).join("") : `
          <tr>
            <td colspan="${columns.length}" class="text-center" style="padding: 18px 14px; color: #64748b; font-weight: 700;">
              ${tr(isFinancial ? "No transactions found for the selected period." : "No records found for the selected filters.")}
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
              return `<td class="text-left font-bold" style="text-transform: uppercase;">${tr("Grand Totals & Net Closing Balance")}</td>`;
            }

            const isDebitCol = c.key.toLowerCase().includes("debit") || c.key === "dr";
            const isCreditCol = c.key.toLowerCase().includes("credit") || c.key === "cr";
            let colorClass = "";
            if (isDebitCol) colorClass = "dr-text";
            else if (isCreditCol) colorClass = "cr-text";

            return `
              <td class="${c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : 'text-left'} font-mono font-bold ${colorClass}">
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
    <div class="meta-box-compact" style="flex-direction: column; align-items: flex-start; gap: 2px;">
      ${paymentTerms ? `<div><strong>${tr("Payment Terms")}:</strong> ${escapeHtml(paymentTerms)}</div>` : ""}
      ${bankDetails ? `<div><strong>${tr("Bank & Wire Details")}:</strong> ${escapeHtml(bankDetails)}</div>` : ""}
      ${notes ? `<div><strong>${tr("Notes")}:</strong> ${escapeHtml(notes)}</div>` : ""}
    </div>
    ` : ""}

    <!-- ── 6. COMPACT SIGNATURE BLOCKS ───────────────────── -->
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

    <!-- ── 7. COMPACT PAGE FOOTER ────────────────────────── -->
    <div class="page-footer">
      <div>${escapeHtml(brandName)} • ${escapeHtml(title)} • ${escapeHtml(fullDateTime)}${(documentNo || ledgerSummary?.accountCode) ? ` • ${tr("Ref")}: ${escapeHtml(documentNo || ledgerSummary?.accountCode || "")}` : ""}</div>
      <div><strong>${tr(isFinancial ? "Confidential Enterprise Statement" : "Confidential")}</strong></div>
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
        containerEl.style.maxWidth = newOrientation === 'landscape' ? '1350px' : '980px';
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

  return html;
}
