import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { printStore } from "@/lib/store/print-store";

export type AccountReportData = {
  accountName: string;
  accountCode: string;
  accountTitle: string;
  subType: string;
  category: string;
  accountGroup?: string;
  manualReferenceNumber?: string;
  currency: string;
  status?: string;

  // Balances (real data; a freshly-created account is 0). Never fabricated.
  openingBalance?: number;
  currentBalance?: number;
  totalDebit?: number;
  totalCredit?: number;

  // Connected Master details
  customerDetail?: any;
  companyDetail?: any;
  bankDetail?: any;

  // Context metadata
  selectedCountryName?: string;
  selectedCountryCode?: string;
  selectedBranchName?: string;
  selectedBranchCode?: string;
  createdBy?: string;
  updatedBy?: string;
};

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function openAccountA4ReportWindow(input: {
  title: string;
  subtitle?: string;
  autoPrint?: boolean;
  accountData: AccountReportData;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  // Every user-visible label goes through the central dictionary (lib/i18n/ui.ts). The 2nd arg is
  // the English fallback only; UR/PS/FA/AR come from the dictionary.
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  const now = new Date();
  const stampDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const formattedDateTime = `${stampDate} ${stampTime}`;

  const b = input.accountData;
  const DASH = tt("acct.no_data", "-");
  const val = (v: unknown) => {
    const s = (v === null || v === undefined || v === "") ? "" : String(v);
    return s ? escapeHtml(s) : DASH;
  };
  const money = (n: number | undefined) =>
    Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const title = escapeHtml(input.title || tt("acct.report_title", "Account Profile Report"));
  const subtitle = escapeHtml(input.subtitle || tt("acct.report_subtitle", "Account Profile Summary"));

  function compactCode(id: string, prefix: string) {
    if (!id) return DASH;
    const clean = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `${prefix}-${clean.slice(0, 4)}`;
  }
  const reg = (needle: string) =>
    b.companyDetail?.registrations?.find((r: any) => String(r.type || "").toLowerCase().includes(needle))?.value;
  const contact = (needle: string) =>
    b.companyDetail?.contacts?.find((c: any) => String(c.type || "").toLowerCase().includes(needle))?.value;

  const row = (label: string, value: string) =>
    `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`;

  const accountGroup = b.accountGroup || b.category || b.subType || "";
  const currentBalance = b.currentBalance ?? ((b.openingBalance ?? 0) + (b.totalDebit ?? 0) - (b.totalCredit ?? 0));

  // 1. Account Information
  const accountInfoHtml =
    row(tt("acct.account_name", "Account Name"), val(b.accountName)) +
    row(tt("acct.account_code", "Account Code"), val(b.accountCode)) +
    row(tt("acct.account_group", "Account Group"), val(accountGroup)) +
    row(tt("acct.account_type", "Account Type"), val(b.subType || b.category)) +
    row(tt("acct.currency", "Currency"), val(b.currency)) +
    row(tt("acct.status", "Status"), `<span class="status-pill">${val(b.status)}</span>`) +
    row(tt("acct.as_on", "Date / As On"), escapeHtml(formattedDateTime));

  // 2. Customer Information
  const custObj = b.customerDetail?.customer;
  const customerHtml =
    row(tt("acct.customer_name", "Customer Name"), val(custObj?.customer_name)) +
    row(tt("acct.company_name", "Company Name"), val(custObj?.company_name)) +
    row(tt("acct.customer_code", "Customer Code"), custObj?.id ? escapeHtml(compactCode(custObj.id, `CUS-${b.selectedCountryCode || "AE"}`)) : DASH) +
    row(tt("acct.phone", "Phone"), val(custObj?.mobile)) +
    row(tt("acct.email", "Email"), val(custObj?.email)) +
    row(tt("acct.address", "Address"), val(custObj?.address)) +
    row(tt("acct.city", "City"), val(b.selectedBranchName?.split(" - ")[0])) +
    row(tt("acct.country", "Country"), val(b.selectedCountryName));

  // 3. Company Details
  const companyHtml =
    row(tt("acct.company_name", "Company Name"), val(b.companyDetail?.companyName || b.companyDetail?.name)) +
    row(tt("acct.company_code", "Company Code"), b.companyDetail?.id ? escapeHtml(compactCode(b.companyDetail.id, "COMP")) : DASH) +
    row(tt("acct.business_type", "Business Type"), val(b.companyDetail?.businessName || b.companyDetail?.legal_name)) +
    row(tt("acct.registration_no", "Registration No."), val(reg("registration") || reg("license") || reg("trade"))) +
    row(tt("acct.address", "Address"), val(b.companyDetail?.address)) +
    row(tt("acct.country", "Country"), val(b.companyDetail?.country)) +
    row(tt("acct.phone", "Phone"), val(contact("phone") || contact("mobile") || contact("number"))) +
    row(tt("acct.email", "Email"), val(contact("email")));

  // 4. Bank Details
  const bankHtml =
    row(tt("acct.bank_name", "Bank Name"), val(b.bankDetail?.bank_name || b.bankDetail?.name)) +
    row(tt("acct.branch_name", "Branch Name"), val(b.bankDetail?.branch_name)) +
    row(tt("acct.account_title", "Account Title"), val(b.bankDetail?.account_title || b.accountName)) +
    row(tt("acct.bank_account_no", "Bank Account Number"), val(b.bankDetail?.account_number)) +
    row(tt("acct.iban", "IBAN"), val(b.bankDetail?.iban_number)) +
    row(tt("acct.swift", "Swift Code"), val(b.bankDetail?.swift_bic)) +
    row(tt("acct.currency", "Currency"), val(b.bankDetail?.currency || b.currency));

  // 5. Tax Information (real registration data; no demo values)
  const taxReg = reg("tax");
  const ntnGst = reg("ntn") || reg("gst");
  const taxRegistered = Boolean(taxReg || ntnGst);
  const taxHtml =
    row(tt("acct.tax_status", "Tax Status"), taxRegistered ? tt("acct.registered", "Registered") : tt("acct.not_registered", "Not Registered")) +
    row(tt("acct.tax_registration_no", "Tax Registration No."), val(taxReg)) +
    row(tt("acct.ntn", "NTN"), val(reg("ntn"))) +
    row(tt("acct.gst_vat", "GST / VAT No."), val(reg("gst") || reg("vat"))) +
    row(tt("acct.tax_type", "Tax Type"), val(reg("tax") ? (b.selectedCountryName || "") : "")) +
    row(tt("acct.currency", "Currency"), val(b.currency));

  // 6. System / Audit Information (real context; no fabricated IP/device)
  const auditHtml =
    row(tt("acct.created_by", "Created By"), val(b.createdBy)) +
    row(tt("acct.created_on", "Created On"), escapeHtml(formattedDateTime)) +
    row(tt("acct.updated_by", "Last Updated By"), val(b.updatedBy || b.createdBy)) +
    row(tt("acct.updated_on", "Last Updated On"), escapeHtml(formattedDateTime)) +
    row(tt("acct.reference_no", "Reference No."), val(b.manualReferenceNumber)) +
    row(tt("acct.branch", "Branch"), val(b.selectedBranchName));

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap');
      @page { size: A4; margin: 12mm; }
      html, body { height: 100%; margin: 0; padding: 0; }
      body { background: #f1f5f9; color: #1e293b; font-family: 'Inter', 'Noto Naskh Arabic', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html[lang="ur"] body { font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Inter', serif; }
      html[lang="ar"] body, html[lang="fa"] body, html[lang="ps"] body { font-family: 'Noto Naskh Arabic', 'Inter', sans-serif; }
      .wrap { padding: 25px; display: flex; justify-content: center; }
      .page {
        width: 210mm; min-height: 297mm; padding: 14mm; margin: 0 auto; background: #ffffff;
        border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(15,23,42,0.08); border-radius: 12px;
        box-sizing: border-box; display: flex; flex-direction: column;
      }
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
      .header-table td { border: none; padding: 0; vertical-align: middle; }
      .logo-title { display: flex; align-items: center; gap: 10px; }
      .logo-icon { width: 36px; height: 36px; background: #1e3a8a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; }
      .logo-text { font-size: 14px; font-weight: 900; color: #0f172a; line-height: 1.1; }
      .logo-subtext { font-size: 8px; color: #64748b; font-weight: 600; line-height: 1.2; }
      .report-title { font-size: 16px; font-weight: 900; color: #1e3a8a; margin: 0 0 4px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.4px; }
      .subtitle-pill { font-size: 8px; font-weight: 800; border: 1px solid #1e3a8a; color: #1e3a8a; border-radius: 999px; padding: 2px 10px; display: inline-block; }
      .meta-box { font-size: 9px; color: #334155; font-weight: 700; line-height: 1.5; }
      .meta-label { color: #64748b; font-weight: 500; }

      .overview-banner { background: #0f172a; color: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 18px; }
      .overview-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
      .overview-title { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
      .overview-name { font-size: 20px; font-weight: 900; color: #fff; margin-top: 2px; word-break: break-word; }
      .overview-status { font-size: 8.5px; font-weight: 800; border: 1px solid rgba(16,185,129,0.35); background: rgba(16,185,129,0.15); color: #34d399; border-radius: 4px; padding: 3px 9px; text-transform: uppercase; white-space: nowrap; }
      .overview-meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; border-bottom: 1px solid #334155; padding-bottom: 12px; }
      .overview-meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .overview-meta-val { font-size: 11px; font-weight: 800; color: #e2e8f0; margin-top: 2px; word-break: break-word; }
      .overview-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
      .kpi { background: rgba(255,255,255,0.04); border-radius: 6px; padding: 8px 10px; }
      .kpi-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .kpi-val { font-size: 14px; font-weight: 900; margin-top: 2px; word-break: break-word; }
      .kpi-open { color: #93c5fd; } .kpi-current { color: #fff; } .kpi-debit { color: #fca5a5; } .kpi-credit { color: #6ee7b7; }

      .section-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
      .section-header { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 9.5px; font-weight: 800; color: #1e293b; letter-spacing: 0.4px; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
      .section-badge { background: #1e3a8a; color: #fff; width: 15px; height: 15px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; flex: 0 0 auto; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .info-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      .info-table td { padding: 5px 10px; font-size: 9.5px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
      .info-table td.label { color: #64748b; font-weight: 600; width: 42%; }
      .info-table td.value { font-weight: 700; color: #1e293b; text-align: end; word-break: break-word; overflow-wrap: anywhere; }
      .status-pill { color: #1d4ed8; font-weight: 900; }

      .footer-signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 14px; border-top: 1px solid #e2e8f0; gap: 16px; }
      .notes-box { width: 55%; font-size: 8px; color: #64748b; line-height: 1.4; }
      .sig-box { width: 30%; text-align: center; font-size: 9px; }
      .sig-line { border-bottom: 1px solid #94a3b8; margin-bottom: 4px; height: 22px; }
      .page-footer { display: flex; justify-content: space-between; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 10px; font-weight: 700; gap: 8px; }

      html[dir="rtl"] body { direction: rtl; }
      html[dir="rtl"] .logo-title { flex-direction: row-reverse; }
      html[dir="rtl"] .info-table td.value { text-align: start; }

      @media print {
        body { background: #fff; }
        .wrap { padding: 0; }
        .page { border: none; box-shadow: none; border-radius: 0; padding: 0; width: 100%; min-height: 100%; }
        .section-card { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="page">
        <table class="header-table">
          <tr>
            <td style="width: 35%;">
              <div class="logo-title">
                <div class="logo-icon">🏢</div>
                <div>
                  <div class="logo-text">ACCOUNTS.DGT.LLC</div>
                  <div class="logo-subtext">Enterprise ERP / FMS</div>
                </div>
              </div>
            </td>
            <td style="width: 30%; text-align: center;">
              <h1 class="report-title">${title}</h1>
              <div class="subtitle-pill">${subtitle}</div>
            </td>
            <td style="width: 35%; text-align: ${isRtl ? "left" : "right"};">
              <div class="meta-box">
                <div><span class="meta-label">${tt("acct.as_on", "Date / As On")} :</span> ${escapeHtml(stampDate)}</div>
                <div><span class="meta-label">${tt("acct.time", "Time")} :</span> ${escapeHtml(stampTime)}</div>
                <div><span class="meta-label">${tt("acct.created_by", "Created By")} :</span> ${val(b.createdBy)}</div>
                <div><span class="meta-label">${tt("acct.report_type", "Report Type")} :</span> ${subtitle}</div>
              </div>
            </td>
          </tr>
        </table>

        <div class="overview-banner">
          <div class="overview-top">
            <div>
              <div class="overview-title">${tt("acct.overview", "Account Profile Overview")}</div>
              <div class="overview-name">${val(b.accountName)}</div>
            </div>
            <span class="overview-status">${val(b.status)}</span>
          </div>

          <div class="overview-meta-grid">
            <div><span class="overview-meta-label">${tt("acct.account_code", "Account Code")}</span><div class="overview-meta-val">${val(b.accountCode)}</div></div>
            <div><span class="overview-meta-label">${tt("acct.account_group", "Account Group")}</span><div class="overview-meta-val">${val(accountGroup)}</div></div>
            <div><span class="overview-meta-label">${tt("acct.currency", "Currency")}</span><div class="overview-meta-val">${val(b.currency)}</div></div>
            <div><span class="overview-meta-label">${tt("acct.as_on", "Date / As On")}</span><div class="overview-meta-val">${escapeHtml(stampDate)}</div></div>
          </div>

          <div class="overview-kpis">
            <div class="kpi"><span class="kpi-label">${tt("acct.opening_balance", "Opening Balance")}</span><div class="kpi-val kpi-open">${money(b.openingBalance)}</div></div>
            <div class="kpi"><span class="kpi-label">${tt("acct.current_balance", "Current Balance")}</span><div class="kpi-val kpi-current">${money(currentBalance)}</div></div>
            <div class="kpi"><span class="kpi-label">${tt("acct.total_debit", "Total Debit")}</span><div class="kpi-val kpi-debit">${money(b.totalDebit)}</div></div>
            <div class="kpi"><span class="kpi-label">${tt("acct.total_credit", "Total Credit")}</span><div class="kpi-val kpi-credit">${money(b.totalCredit)}</div></div>
          </div>
        </div>

        <div class="grid-2">
          <div class="section-card">
            <div class="section-header"><span class="section-badge">1</span> ${tt("acct.sec_account_info", "Account Information")}</div>
            <table class="info-table">${accountInfoHtml}</table>
          </div>
          <div class="section-card">
            <div class="section-header"><span class="section-badge">2</span> ${tt("acct.sec_customer_info", "Customer Information")}</div>
            <table class="info-table">${customerHtml}</table>
          </div>
        </div>

        <div class="grid-2">
          <div class="section-card">
            <div class="section-header"><span class="section-badge">3</span> ${tt("acct.sec_company_details", "Company Details")}</div>
            <table class="info-table">${companyHtml}</table>
          </div>
          <div class="section-card">
            <div class="section-header"><span class="section-badge">4</span> ${tt("acct.sec_bank_details", "Bank Details")}</div>
            <table class="info-table">${bankHtml}</table>
          </div>
        </div>

        <div class="grid-2">
          <div class="section-card">
            <div class="section-header"><span class="section-badge">5</span> ${tt("acct.sec_tax_info", "Tax Information")}</div>
            <table class="info-table">${taxHtml}</table>
          </div>
          <div class="section-card">
            <div class="section-header"><span class="section-badge">6</span> ${tt("acct.sec_audit_info", "System / Audit Information")}</div>
            <table class="info-table">${auditHtml}</table>
          </div>
        </div>

        <div class="footer-signatures">
          <div class="notes-box">
            <strong style="color:#0f172a; font-size:9px; display:block; margin-bottom:2px;">${tt("acct.remarks", "Remarks / Notes")}</strong>
            <span>${tt("acct.remarks_body", "This is the official account setup profile document generated by the ERP.")}</span>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div style="font-size:8px; font-weight:700; color:#64748b;">${tt("acct.authorized_signature", "Authorized Signature")}</div>
            <div style="font-size:7px; color:#94a3b8; font-weight:500;">${tt("acct.administration", "FMS Administration")}</div>
          </div>
        </div>

        <div class="page-footer">
          <div>🏢 ACCOUNTS.DGT.LLC | Enterprise ERP / FMS</div>
          <div>Report ID: ACC-${val(b.accountCode)}-${escapeHtml(stampDate.replace(/[ ,]/g, ""))}</div>
          <div>1 / 1</div>
        </div>
      </div>
    </div>
    <script>
      window.__ERP_A4_AUTOPRINT__ = ${input.autoPrint ? "true" : "false"};
      window.addEventListener('load', () => {
        if (window.__ERP_A4_AUTOPRINT__) { setTimeout(() => window.print(), 120); }
      }, { once: true });
    </script>
  </body>
</html>`;

  printStore.openPrint(html, input.title);
}
