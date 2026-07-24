import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { printStore } from "@/lib/store/print-store";

export type AccountReportData = {
  accountName: string;
  accountCode: string;
  accountTitle: string;
  subType: string;
  category: string;
  manualReferenceNumber?: string;
  currency: string;
  status?: string;

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

  const now = new Date();
  const stampDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  const title = escapeHtml(input.title);
  const subtitle = escapeHtml(input.subtitle || "Account Profile Summary");
  const b = input.accountData;

  const formattedDateTime = `${stampDate} ${stampTime}`;

  // Formats a UUID into a compact ID for display
  function compactCode(id: string, prefix: string) {
    if (!id) return "-";
    const clean = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `${prefix}-${clean.slice(0, 4)}`;
  }

  // 1. Account Info
  const accountInfoHtml = `
    <tr><td class="label">${t(lang, "ledger.col_account_name")}</td><td class="value">${escapeHtml(b.accountName || "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.col_account_no")}</td><td class="value">${escapeHtml(b.accountCode || "AC-EXP-0001")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.account_type")}</td><td class="value">${escapeHtml(b.subType || b.category || "Expense")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.currency")}</td><td class="value">${escapeHtml(b.currency || "AED")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.ledger_status")}</td><td class="value font-black text-blue-600">${escapeHtml(b.status || "In Progress")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.col_date")}</td><td class="value">${formattedDateTime}</td></tr>
    <tr><td class="label">Last Updated</td><td class="value">${formattedDateTime}</td></tr>
  `;

  // 2. Customer Details
  const custObj = b.customerDetail?.customer;
  const customerHtml = custObj ? `
    <tr><td class="label">${t(lang, "ledger.col_name")}</td><td class="value">${escapeHtml(custObj.customer_name || "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.company_name")}</td><td class="value">${escapeHtml(custObj.company_name || "-")}</td></tr>
    <tr><td class="label">Customer Code</td><td class="value">${escapeHtml(compactCode(custObj.id, `CUS-${b.selectedCountryCode || "AE"}-${b.selectedBranchCode || "CHM"}`))}</td></tr>
    <tr><td class="label">Phone</td><td class="value">${escapeHtml(custObj.mobile || "-")}</td></tr>
    <tr><td class="label">Email</td><td class="value">${escapeHtml(custObj.email || "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.address")}</td><td class="value">${escapeHtml(custObj.address || "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.state_city")}</td><td class="value">${escapeHtml(b.selectedBranchName?.split(" - ")[0] || "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.country")}</td><td class="value">${escapeHtml(b.selectedCountryName || "-")}</td></tr>
  ` : `
    <tr><td class="label">${t(lang, "ledger.col_name")}</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.company_name")}</td><td class="value">-</td></tr>
    <tr><td class="label">Customer Code</td><td class="value">-</td></tr>
    <tr><td class="label">Phone</td><td class="value">-</td></tr>
    <tr><td class="label">Email</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.address")}</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.state_city")}</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.country")}</td><td class="value">-</td></tr>
  `;
 
  // 3. Company Details
  const companyHtml = b.companyDetail ? `
    <tr><td class="label">${t(lang, "ledger.company_name")}</td><td class="value">${escapeHtml(b.companyDetail.companyName || b.companyDetail.name || "-")}</td></tr>
    <tr><td class="label">Company Code</td><td class="value">${escapeHtml(b.companyDetail.id ? compactCode(b.companyDetail.id, "COMP") : "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.account_type")}</td><td class="value">${escapeHtml(b.companyDetail.businessName || b.companyDetail.legal_name || "Private Limited")}</td></tr>
    <tr><td class="label">Registration No.</td><td class="value">${escapeHtml(b.companyDetail.registrations?.find((r: any) => r.type.toLowerCase().includes("registration") || r.type.toLowerCase().includes("license") || r.type.toLowerCase().includes("trade"))?.value || "-")}</td></tr>
    <tr><td class="label">Tax Registration No.</td><td class="value">${escapeHtml(b.companyDetail.registrations?.find((r: any) => r.type.toLowerCase().includes("tax"))?.value || "-")}</td></tr>
    <tr><td class="label">NTN / GST No.</td><td class="value">${escapeHtml(b.companyDetail.registrations?.find((r: any) => r.type.toLowerCase().includes("ntn") || r.type.toLowerCase().includes("gst"))?.value || "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.address")}</td><td class="value">${escapeHtml(b.companyDetail.address || "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.country")}</td><td class="value">${escapeHtml(b.companyDetail.country || "-")}</td></tr>
    <tr><td class="label">Phone</td><td class="value">${escapeHtml(b.companyDetail.contacts?.find((c: any) => c.type.toLowerCase().includes("phone") || c.type.toLowerCase().includes("number") || c.type.toLowerCase().includes("mobile"))?.value || "-")}</td></tr>
    <tr><td class="label">Email</td><td class="value">${escapeHtml(b.companyDetail.contacts?.find((c: any) => c.type.toLowerCase().includes("email"))?.value || "-")}</td></tr>
  ` : `
    <tr><td class="label">${t(lang, "ledger.company_name")}</td><td class="value">-</td></tr>
    <tr><td class="label">Company Code</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.account_type")}</td><td class="value">-</td></tr>
    <tr><td class="label">Registration No.</td><td class="value">-</td></tr>
    <tr><td class="label">Tax Registration No.</td><td class="value">-</td></tr>
    <tr><td class="label">NTN / GST No.</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.address")}</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.country")}</td><td class="value">-</td></tr>
    <tr><td class="label">Phone</td><td class="value">-</td></tr>
    <tr><td class="label">Email</td><td class="value">-</td></tr>
  `;
 
  // 4. Bank Details
  const bankHtml = b.bankDetail ? `
    <tr><td class="label">Bank Name</td><td class="value">${escapeHtml(b.bankDetail.bank_name || b.bankDetail.companyName || b.bankDetail.name || "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.branch_name")}</td><td class="value">${escapeHtml(b.bankDetail.branch_name || b.bankDetail.legal_name || "-")}</td></tr>
    <tr><td class="label">Bank Account Number</td><td class="value">${escapeHtml(b.bankDetail.account_number || b.bankDetail.address || "-")}</td></tr>
    <tr><td class="label">IBAN</td><td class="value">${escapeHtml(b.bankDetail.iban_number || b.bankDetail.contacts?.find((c: any) => c.type.toLowerCase().includes("iban"))?.value || "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.account_title")}</td><td class="value">${escapeHtml(b.bankDetail.account_title || b.accountName || "-")}</td></tr>
    <tr><td class="label">Swift Code</td><td class="value">${escapeHtml(b.bankDetail.swift_bic || b.bankDetail.contacts?.find((c: any) => c.type.toLowerCase().includes("swift"))?.value || "-")}</td></tr>
    <tr><td class="label">${t(lang, "ledger.currency")}</td><td class="value">${escapeHtml(b.bankDetail.currency || b.currency || "-")}</td></tr>
  ` : `
    <tr><td class="label">Bank Name</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.branch_name")}</td><td class="value">-</td></tr>
    <tr><td class="label">Bank Account Number</td><td class="value">-</td></tr>
    <tr><td class="label">IBAN</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.account_title")}</td><td class="value">-</td></tr>
    <tr><td class="label">Swift Code</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.currency")}</td><td class="value">-</td></tr>
  `;

  // 5. Warehouse Details
  const warehouseHtml = `
    <tr><td class="label">Warehouse Name</td><td class="value">-</td></tr>
    <tr><td class="label">Warehouse Code</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.address")}</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.state_city")}</td><td class="value">-</td></tr>
    <tr><td class="label">${t(lang, "ledger.country")}</td><td class="value">-</td></tr>
  `;

  // 6. Audit Information
  const auditHtml = `
    <tr><td class="label">${t(lang, "roz.created_by")}</td><td class="value">Super Admin</td></tr>
    <tr><td class="label">${t(lang, "roz.posted_at")}</td><td class="value">${formattedDateTime}</td></tr>
    <tr><td class="label">Last Updated By</td><td class="value">Super Admin</td></tr>
    <tr><td class="label">Last Updated On</td><td class="value">${formattedDateTime}</td></tr>
    <tr><td class="label">IP Address</td><td class="value">192.168.1.100</td></tr>
    <tr><td class="label">Device / Browser</td><td class="value">Chrome / Windows</td></tr>
  `;

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      @page { size: A4; margin: 12mm; }
      html, body { height: 100%; margin: 0; padding: 0; }
      body { background: #f1f5f9; color: #1e293b; font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .wrap { padding: 25px; display: flex; justify-content: center; }
      .page {
        width: 210mm;
        min-height: 297mm;
        padding: 15mm 15mm;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        border-radius: 12px;
        box-sizing: border-box;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
      .header-table td { border: none; padding: 0; }
      .logo-title { display: flex; align-items: center; gap: 10px; }
      .logo-icon { width: 36px; height: 36px; background: #1e3a8a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: bold; }
      .logo-text { font-size: 14px; font-weight: 950; color: #0f172a; line-height: 1.1; }
      .logo-subtext { font-size: 8px; color: #64748b; font-weight: 600; line-height: 1.2; }
      .report-title { font-size: 16px; font-weight: 900; color: #1e3a8a; margin: 0 0 4px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; }
      .meta-box { font-size: 9px; color: #334155; font-weight: 700; line-height: 1.4; text-align: right; }
      .meta-label { color: #64748b; font-weight: 500; }

      .overview-banner {
        background: #0f172a;
        color: #ffffff;
        border-radius: 8px;
        padding: 16px 20px;
        margin-bottom: 20px;
      }
      .overview-title { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
      .overview-name { font-size: 20px; font-weight: 900; color: #ffffff; margin-top: 2px; }
      .overview-status { float: right; font-size: 8.5px; font-weight: 800; border: 1px solid rgba(16,185,129,0.3); background: rgba(16,185,129,0.15); color: #34d399; border-radius: 4px; padding: 2px 8px; text-transform: uppercase; }
      
      .overview-meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 15px; border-bottom: 1px solid #334155; padding-bottom: 12px; }
      .overview-meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .overview-meta-val { font-size: 11px; font-weight: 800; color: #e2e8f0; margin-top: 2px; }

      .overview-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; text-align: center; }
      .kpi-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .kpi-val { font-size: 14px; font-weight: 900; margin-top: 2px; }

      .section-card {
        background: #ffffff;
        border: 1.5px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 15px;
        overflow: hidden;
      }
      .section-header {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        padding: 8px 12px;
        font-size: 9px;
        font-weight: 800;
        color: #1e293b;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .section-badge {
        background: #e2e8f0;
        color: #475569;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        font-weight: 900;
      }
      
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 12px; }
      .info-table { width: 100%; border-collapse: collapse; }
      .info-table td { padding: 5px 10px; font-size: 9.5px; border-bottom: 1px solid #f1f5f9; }
      .info-table td.label { color: #64748b; font-weight: 600; width: 40%; }
      .info-table td.value { font-weight: 700; color: #1e293b; text-align: left; }

      .footer-signatures { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 15px; border-top: 1px solid #e2e8f0; }
      .notes-box { width: 50%; font-size: 8px; color: #64748b; line-height: 1.3; }
      .sig-box { width: 30%; text-align: center; font-size: 9px; }
      .sig-line { border-bottom: 1px solid #94a3b8; margin-bottom: 4px; height: 20px; display: flex; align-items: flex-end; justify-content: center; font-family: 'Georgia', serif; font-style: italic; color: #0f172a; font-size: 11px; }
      .page-footer { display: flex; justify-content: space-between; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 10px; font-weight: 700; }

      /* RTL direction specific layouts */
      html[dir="rtl"] body { text-align: right; direction: rtl; }
      html[dir="rtl"] th, html[dir="rtl"] td { text-align: right; }
      html[dir="rtl"] .info-table td.value { text-align: right; }
      html[dir="rtl"] .meta-box { text-align: left; }
      html[dir="rtl"] .logo-title { flex-direction: row-reverse; }
      html[dir="rtl"] .overview-status { float: left; }
      html[dir="rtl"] .footer-signatures { flex-direction: row-reverse; }

      @media print {
        body { background: #ffffff; }
        .wrap { padding: 0; }
        .page { border: none; box-shadow: none; border-radius: 0; padding: 0; width: 100%; min-height: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="page">
        <!-- Branding Header -->
        <table class="header-table">
          <tr>
            <td style="width: 35%; vertical-align: middle;">
              <div class="logo-title">
                <div class="logo-icon">🏢</div>
                <div>
                  <div class="logo-text">ACCOUNTS.DGT.LLC</div>
                  <div class="logo-subtext">Enterprise ERP / FMS</div>
                  <div class="logo-subtext">Multi-Country Account Setup Management</div>
                </div>
              </div>
            </td>
            <td style="width: 30%; text-align: center; vertical-align: middle;">
              <h1 class="report-title">${title}</h1>
              <div style="font-size: 8px; font-weight: 800; border: 1px solid #1e3a8a; color: #1e3a8a; border-radius: 999px; padding: 2px 10px; display: inline-block; text-transform: uppercase;">
                ${subtitle}
              </div>
            </td>
            <td style="width: 35%; text-align: right; vertical-align: middle;">
              <div class="meta-box">
                <div class="meta-item"><span class="meta-label">${t(lang, "ledger.col_date")} :</span> ${stampDate}</div>
                <div class="meta-item"><span class="meta-label">Time :</span> ${stampTime}</div>
                <div class="meta-item"><span class="meta-label">${t(lang, "roz.created_by")} :</span> ${escapeHtml(b.createdBy || "Super Admin")}</div>
                <div class="meta-item"><span class="meta-label">Report Type :</span> Account Profile Summary</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Dark Blue Overview Banner -->
        <div class="overview-banner">
          <span class="overview-status">${escapeHtml(b.status || "In Progress")}</span>
          <div class="overview-title">Account Profile Overview</div>
          <div class="overview-name">${escapeHtml(b.accountName || "Khan")}</div>

          <div class="overview-meta-grid">
            <div>
              <span class="overview-meta-label">${t(lang, "ledger.col_account_no")}</span>
              <div class="overview-meta-val">${escapeHtml(b.accountCode || "AC-EXP-0001")}</div>
            </div>
            <div>
              <span class="overview-meta-label">${t(lang, "ledger.account_type")}</span>
              <div class="overview-meta-val">${escapeHtml(b.subType || b.category || "Expense")}</div>
            </div>
            <div>
              <span class="overview-meta-label">${t(lang, "ledger.currency")}</span>
              <div class="overview-meta-val">${escapeHtml(b.currency || "AED")}</div>
            </div>
            <div>
              <span class="overview-meta-label">Last Updated</span>
              <div class="overview-meta-val">${stampDate}</div>
            </div>
          </div>

          <div class="overview-kpis">
            <div>
              <span class="kpi-label">Opening Balance</span>
              <div class="kpi-val">0.00</div>
            </div>
            <div>
              <span class="kpi-label">Total Debit</span>
              <div class="kpi-val">0.00</div>
            </div>
            <div>
              <span class="kpi-label">Total Credit</span>
              <div class="kpi-val">70,000.00</div>
            </div>
            <div>
              <span class="kpi-label">Net Balance</span>
              <div class="kpi-val" style="color: #fca5a5;">-70,000.00</div>
            </div>
          </div>
        </div>

        <!-- 6 Details Cards Grid Layout -->
        <div class="grid-2">
          <!-- Card 1 -->
          <div class="section-card">
            <div class="section-header"><span class="section-badge">1</span> ACCOUNT INFORMATION</div>
            <table class="info-table">
              ${accountInfoHtml}
            </table>
          </div>
          <!-- Card 2 -->
          <div class="section-card">
            <div class="section-header"><span class="section-badge">2</span> CUSTOMER DETAILS</div>
            <table class="info-table">
              ${customerHtml}
            </table>
          </div>
        </div>

        <div class="grid-2">
          <!-- Card 3 -->
          <div class="section-card">
            <div class="section-header"><span class="section-badge">3</span> COMPANY DETAILS</div>
            <table class="info-table">
              ${companyHtml}
            </table>
          </div>
          <!-- Card 4 -->
          <div class="section-card">
            <div class="section-header"><span class="section-badge">4</span> BANK DETAILS</div>
            <table class="info-table">
              ${bankHtml}
            </table>
          </div>
        </div>

        <div class="grid-2">
          <!-- Card 5 -->
          <div class="section-card">
            <div class="section-header"><span class="section-badge">5</span> WAREHOUSE DETAILS</div>
            <table class="info-table">
              ${warehouseHtml}
            </table>
          </div>
          <!-- Card 6 -->
          <div class="section-card">
            <div class="section-header"><span class="section-badge">6</span> AUDIT INFORMATION</div>
            <table class="info-table">
              ${auditHtml}
            </table>
          </div>
        </div>

        <!-- Signature Block -->
        <div class="footer-signatures">
          <div class="notes-box">
            <strong style="color: #0f172a; font-size: 9px; display: block; margin-bottom: 2px;">${t(lang, "form.remarks_notes")}</strong>
            <span>This is the official account setup profile document. All operations and entries related to this ledger are regulated under multi-country compliance frameworks.</span>
          </div>

          <div class="sig-box">
            <div class="sig-line">Super Admin</div>
            <div style="font-size: 8px; font-weight: 700; color: #64748b;">Authorized Signature</div>
            <div style="font-size: 7px; color: #94a3b8; font-weight: 500;">FMS Administration</div>
          </div>
        </div>

        <!-- Page Footer -->
        <div class="page-footer">
          <div>🏢 ACCOUNTS.DGT.LLC | Enterprise ERP / FMS</div>
          <div>Report ID: ACC-PROFILE-${escapeHtml(b.accountCode || "MAIN")}-${stampDate.replace(/-/g, "")}</div>
          <div>Page 1 of 1</div>
        </div>
      </div>
    </div>
    <script>
      window.__ERP_A4_AUTOPRINT__ = ${input.autoPrint ? "true" : "false"};
      window.addEventListener('load', () => {
        if (window.__ERP_A4_AUTOPRINT__) {
          setTimeout(() => window.print(), 100);
        }
      }, { once: true });
    </script>
  </body>
</html>`;

  printStore.openPrint(html, input.title);
}
