import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { printStore } from "@/lib/store/print-store";

export type A4ReportRow = { label: string; value: string };

export type ParentBranchInfo = {
  name: string;
  code: string;
  type: string;
  status: string;
  currency?: string;
  country?: string;
};

export type BranchReportData = {
  serialNumber?: string;
  branchStatus?: string;
  branchCode?: string;
  branchType?: string;
  country?: string;
  currency?: string;
  
  parentBranch?: ParentBranchInfo;
  grandparentBranch?: ParentBranchInfo;

  // Section 1: Branch Information
  branchName?: string;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  updatedBy?: string;
  establishedOn?: string;
  taxRegNo?: string;
  ntnGstNo?: string;

  // Section 2: Branch Details
  city?: string;
  cityCode?: string;
  stateProvince?: string;
  areaRegion?: string;
  zipCode?: string;
  fullAddress?: string;

  // Section 3: Owner Details
  ownerName?: string;
  ownerCode?: string;
  fatherHusbandName?: string;
  cnicId?: string;
  nationality?: string;
  designation?: string;
  ownershipType?: string;
  ownershipPercent?: string;
  phone?: string;
  email?: string;
  ownerCountry?: string;
  ownerPhone?: string;
  ownerWhatsApp?: string;
  ownerEmail?: string;
  ownerAltEmail?: string;
  ownerLandline?: string;
  ownerWebsite?: string;

  // Section 4: Company Details
  companyName?: string;
  companyCode?: string;
  companyType?: string;
  companyRegNo?: string;
  companyIncDate?: string;
  companyTaxRegNo?: string;
  companyNtnGstNo?: string;
  companyStatus?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyOfficeAddress?: string;

  // Section 5: Permissions
  allowedPermissions?: string[];
  remarks?: string;
};

export type RoznamchaCashEntryReportData = {
  companyName?: string;
  voucherNo?: string;
  journalNo?: string;
  entrySerial?: string;
  entryDate?: string;
  status?: string;

  counterpartyName?: string;
  counterpartyCode?: string;
  accountNo?: string;
  country?: string;
  branch?: string;
  bankName?: string;
  paymentMethod?: string;

  financialLines: Array<{
    description?: string;
    accountCode?: string;
    accountName?: string;
    currency?: string;
    debit?: number;
    credit?: number;
    exchangeRate?: number;
    convertedAmount?: number;
  }>;

  showUsdReporting?: boolean;
  totalDebit?: number;
  totalCredit?: number;
  balanceDirection?: "DR" | "CR" | "—";
  finalBalance?: number;
  currency?: string;
  narration?: string;
  createdBy?: string;
  approvedBy?: string;
};

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function openA4ReportWindow(input: {
  title: string;
  subtitle?: string;
  rows?: A4ReportRow[];
  autoPrint?: boolean;
  branchData?: BranchReportData;
  cashEntryData?: RoznamchaCashEntryReportData;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const now = new Date();
  const stampDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  const title = escapeHtml(input.title);
  const subtitle = escapeHtml(input.subtitle || "");

  let contentHtml = "";

  // Ignore configuration-placeholder strings that occasionally get typed into the
  // company/branch record so they never show up in a printed document.
  const clean = (v: unknown): string => {
    const s = String(v ?? "").trim();
    if (!s || /^(configured\b|n\/?a$|none$|null$|undefined$|-+$|tbd$|todo$|placeholder\b|not\s+set$|not\s+configured$)/i.test(s)) return "";
    return s;
  };

  if (input.branchData) {
    const rawB = input.branchData;
    const b: typeof rawB = { ...rawB };
    for (const k of ["ownerPhone", "ownerEmail", "ownerAltEmail", "ownerWebsite", "companyPhone", "companyEmail", "companyWebsite", "companyOfficeAddress"] as const) {
      if (k in b) (b as Record<string, unknown>)[k] = clean((b as Record<string, unknown>)[k]) || undefined;
    }
    const permissionsMap = [
      { key: "dashboard.access", label: "Dashboard Access" },
      { key: "branch.new_entry", label: "Branch Entry (New)" },
      { key: "branch.edit", label: "Branch Edit / Update" },
      { key: "branch.delete", label: "Branch Delete" },
      { key: "users.access", label: "Users Access" },
      { key: "users.create", label: "Users Create / Invite" },
      { key: "users.edit", label: "Users Edit / Update" },
      { key: "accounts.access", label: "Accounts Access" },
      { key: "accounts.new_entry", label: "Accounts Create" },
      { key: "accounts.master", label: "Accounts Edit / Update" },
      { key: "ledgers.general", label: "Ledger Access" },
      { key: "journal.roznamcha.general", label: "Journal Entry" },
      { key: "journal.daily_payment.add_new", label: "Daily Payment" },
      { key: "purchase.entry", label: "Purchase Entry" },
      { key: "sales.entry", label: "Sales Entry" },
      { key: "reports.view", label: "Reports Access" },
      { key: "reports.export", label: "Reports Export (PDF/Excel)" },
      { key: "settings.access", label: "Settings Access" },
      { key: "settings.user_permissions", label: "User Permission Manage" },
      { key: "branches.manage", label: "Branch Permission Manage" },
      { key: "reports.roznamcha.bulk", label: "Bulk Operations" },
      { key: "inventory.access", label: "Inventory Access" },
      { key: "inventory.stock", label: "Stock Management" },
      { key: "masters.access", label: "Suppliers Access" },
      { key: "masters.customers", label: "Customers Access" },
      { key: "finance.access", label: "Bank Management" },
      { key: "finance.cheque", label: "Cheque Management" },
      { key: "settings.system", label: "All Modules Access" }
    ];

    const allowedSet = new Set(b.allowedPermissions || []);

    const permissionItemsHtml = permissionsMap.map(item => {
      const isAllowed = allowedSet.has(item.key) || allowedSet.has("settings.access") || allowedSet.has("branch.super_admin");
      const iconClass = isAllowed ? "allowed" : "not-allowed";
      const iconText = isAllowed ? "✓" : "✗";
      return `
        <div class="perm-item">
          <div class="perm-icon ${iconClass}">${iconText}</div>
          <span>${item.label}</span>
        </div>
      `;
    }).join("");

    contentHtml = `
      <table class="header-table">
        <tr>
          <td style="width: 35%; vertical-align: middle;">
            <div class="logo-title">
              <div class="logo-icon">🏢</div>
              <div>
                <div class="logo-text">ACCOUNTS.DGT.LLC</div>
                <div class="logo-subtext">Enterprise ERP / FMS</div>
                <div class="logo-subtext">Multi-Country Branch Management System</div>
              </div>
            </div>
          </td>
          <td style="width: 30%; text-align: center; vertical-align: middle;">
            <h1 class="report-title">${title}</h1>
            <div style="font-size: 8px; font-weight: 800; border: 1px solid #2563eb; color: #2563eb; border-radius: 999px; padding: 2px 10px; display: inline-block; text-transform: uppercase;">
              ${subtitle || "Store Entry Preview (A4)"}
            </div>
          </td>
          <td style="width: 35%; text-align: right; vertical-align: middle;">
            <div class="meta-box">
              <div class="meta-item"><span class="meta-label">${t(lang, "ledger.col_date")} :</span> ${stampDate}</div>
              <div class="meta-item"><span class="meta-label">Time :</span> ${stampTime}</div>
              <div class="meta-item"><span class="meta-label">${t(lang, "roz.created_by")} :</span> ${escapeHtml(b.createdBy || "Super Admin")}</div>
              <div class="meta-item"><span class="meta-label">Report Type :</span> Branch Detail Report</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Parent Scope Hierarchy Context -->
      ${(b.parentBranch || b.grandparentBranch) ? `
      <div class="hierarchy-box">
        <div class="hierarchy-title">
          🛡️ Parent Scope Security Hierarchy Context
        </div>
        <div class="hierarchy-steps">
          ${b.grandparentBranch ? `
            <div class="hierarchy-step-card">
              <span class="hierarchy-step-type">${escapeHtml(b.grandparentBranch.type.toUpperCase())}</span>
              <span class="hierarchy-step-name">${escapeHtml(b.grandparentBranch.name)}</span>
              <span class="hierarchy-step-code">Code: ${escapeHtml(b.grandparentBranch.code)} (${escapeHtml(b.grandparentBranch.status)})</span>
            </div>
            <span class="hierarchy-arrow">➔</span>
          ` : ""}
          ${b.parentBranch ? `
            <div class="hierarchy-step-card">
              <span class="hierarchy-step-type">${escapeHtml(b.parentBranch.type.toUpperCase())}</span>
              <span class="hierarchy-step-name">${escapeHtml(b.parentBranch.name)}</span>
              <span class="hierarchy-step-code">Code: ${escapeHtml(b.parentBranch.code)} (${escapeHtml(b.parentBranch.status)})</span>
            </div>
            <span class="hierarchy-arrow">➔</span>
          ` : ""}
          <div class="hierarchy-step-card" style="background: #eff6ff; border-color: #bfdbfe; box-shadow: 0 1px 2px rgba(37,99,235,0.05);">
            <span class="hierarchy-step-type" style="color: #2563eb;">${escapeHtml((b.branchType || "NEW").toUpperCase())}</span>
            <span class="hierarchy-step-name" style="color: #1e3a8a; font-weight: 800;">${escapeHtml(b.branchName || "Creating branch...")}</span>
            <span class="hierarchy-step-code" style="color: #2563eb;">Code: ${escapeHtml(b.branchCode || "-")} (CREATING)</span>
          </div>
        </div>
      </div>
      ` : ""}

      <!-- KPI Ribbon Row -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-icon-container" style="background: #ecfdf5; color: #16a34a; border-color: #a7f3d0;">✓</div>
          <div class="kpi-content">
            <span class="kpi-label">${t(lang, "ledger.ledger_status")}</span>
            <span class="kpi-value" style="color: #16a34a;">${escapeHtml((b.branchStatus || "Active").toUpperCase())}</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon-container" style="background: #eff6ff; color: #2563eb; border-color: #bfdbfe;">📌</div>
          <div class="kpi-content">
            <span class="kpi-label">${t(lang, "ledger.branch_account_no")}</span>
            <span class="kpi-value">${escapeHtml(b.branchCode || "-")}</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon-container" style="background: #fdf2f8; color: #db2777; border-color: #fbcfe8;">🏢</div>
          <div class="kpi-content">
            <span class="kpi-label">${t(lang, "ledger.account_type")}</span>
            <span class="kpi-value">${escapeHtml((b.branchType || "MAIN").toUpperCase())}</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon-container" style="background: #f0fdf4; color: #15803d; border-color: #bbf7d0;">🌍</div>
          <div class="kpi-content">
            <span class="kpi-label">${t(lang, "ledger.country")}</span>
            <span class="kpi-value">${escapeHtml((b.country || "-").toUpperCase())}</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon-container" style="background: #fffbeb; color: #d97706; border-color: #fde68a;">💵</div>
          <div class="kpi-content">
            <span class="kpi-label">${t(lang, "ledger.currency")}</span>
            <span class="kpi-value">${escapeHtml((b.currency || "USD").toUpperCase())}</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon-container" style="background: #f8fafc; color: #64748b; border-color: #cbd5e1;">#</div>
          <div class="kpi-content">
            <span class="kpi-label">${t(lang, "ledger.col_serial")}</span>
            <span class="kpi-value">${escapeHtml(b.serialNumber || "0001")}</span>
          </div>
        </div>
      </div>

      <!-- Sections Grid -->
      <div class="grid-2">
        <!-- Section 1: Branch Information -->
        <div>
          <div class="section-title">
            <span class="section-num">1</span>
            <span>${t(lang, "ledger.branch_details")}</span>
          </div>
          <table class="info-table">
            <tr>
              <td class="label">${t(lang, "ledger.col_serial")}</td>
              <td class="value">${escapeHtml(b.serialNumber || "0001")}</td>
            </tr>
            <tr>
              <td class="label">${t(lang, "ledger.branch_account_no")}</td>
              <td class="value">${escapeHtml(b.branchCode || "-")}</td>
            </tr>
            <tr>
              <td class="label">${t(lang, "ledger.branch_name")}</td>
              <td class="value">${escapeHtml(b.branchName || "-")}</td>
            </tr>
            <tr>
              <td class="label">${t(lang, "ledger.account_type")}</td>
              <td class="value">${escapeHtml(b.branchType || "MAIN")}</td>
            </tr>
            <tr>
              <td class="label">${t(lang, "ledger.country")}</td>
              <td class="value">${escapeHtml(b.country || "-")}</td>
            </tr>
            <tr>
              <td class="label">${t(lang, "ledger.currency")}</td>
              <td class="value">${escapeHtml(b.currency || "-")}</td>
            </tr>
            <tr>
              <td class="label">${t(lang, "ledger.ledger_status")}</td>
              <td class="value" style="color: #16a34a;">${escapeHtml(b.branchStatus || "Active")}</td>
            </tr>
          </table>
        </div>

        <!-- Section 1 (cont): Additional Dates & Metadata -->
        <div style="margin-top: 21px;">
          <table class="info-table" style="margin-top: 1px;">
            <tr>
              <td class="label">${t(lang, "roz.posted_at")}</td>
              <td class="value">${escapeHtml(b.createdDate || stampDate)}</td>
            </tr>
            <tr>
              <td class="label">Updated Date</td>
              <td class="value">${escapeHtml(b.updatedDate || stampDate)}</td>
            </tr>
            <tr>
              <td class="label">${t(lang, "roz.created_by")}</td>
              <td class="value">${escapeHtml(b.createdBy || "Super Admin")}</td>
            </tr>
            <tr>
              <td class="label">Updated By</td>
              <td class="value">${escapeHtml(b.updatedBy || "Super Admin")}</td>
            </tr>
            <tr>
              <td class="label">Branch Established On</td>
              <td class="value">${escapeHtml(b.establishedOn || "-")}</td>
            </tr>
            <tr>
              <td class="label">Tax Registration No.</td>
              <td class="value">${escapeHtml(b.taxRegNo || "-")}</td>
            </tr>
            <tr>
              <td class="label">N.T.N / G.S.T No.</td>
              <td class="value">${escapeHtml(b.ntnGstNo || "-")}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Section 2: Branch Details -->
      <div class="grid-1">
        <div>
          <div class="section-title">
            <span class="section-num">2</span>
            <span>${t(lang, "ledger.branch_details")}</span>
          </div>
          <table class="info-table">
            <tr>
              <td class="label" style="width: 20%;">${t(lang, "ledger.state_city")}</td>
              <td class="value" style="width: 30%;">${escapeHtml(b.city || "-")}</td>
              <td class="label" style="width: 20%;">City Code</td>
              <td class="value" style="width: 30%;">${escapeHtml(b.cityCode || "-")}</td>
            </tr>
            <tr>
              <td class="label" style="width: 20%;">State / Province</td>
              <td class="value" style="width: 30%;">${escapeHtml(b.stateProvince || "-")}</td>
              <td class="label" style="width: 20%;">Area / District</td>
              <td class="value" style="width: 30%;">${escapeHtml(b.areaRegion || "-")}</td>
            </tr>
            <tr>
              <td class="label" style="width: 20%;">Postal / Zip Code</td>
              <td class="value" style="width: 30%;">${escapeHtml(b.zipCode || "-")}</td>
              <td class="label" style="width: 20%;">${t(lang, "ledger.address")}</td>
              <td class="value" style="width: 30%;">${escapeHtml(b.fullAddress || "-")}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Section 3: Owner Details -->
      <div class="grid-2">
        <div>
          <div class="section-title">
            <span class="section-num">3</span>
            <span>Owner Details</span>
          </div>
          <div class="owner-card">
            <div class="avatar-box">👤</div>
            <div style="flex-1;">
              <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${escapeHtml(b.ownerName || "-")}</div>
              ${b.ownerCode ? `<div style="font-size: 9px; color: #64748b; font-weight: 600; margin-top: 2px;">Owner Code: ${escapeHtml(b.ownerCode)}</div>` : ""}
              ${b.designation ? `<div style="font-size: 9px; color: #64748b; font-weight: 600; margin-top: 1px;">Designation: ${escapeHtml(b.designation)}</div>` : ""}
            </div>
          </div>
          <table class="info-table" style="margin-top: 8px;">
            <tr>
              <td class="label">Father/Husband Name</td>
              <td class="value">${escapeHtml(b.fatherHusbandName || "-")}</td>
            </tr>
            <tr>
              <td class="label">CNIC / ID Number</td>
              <td class="value">${escapeHtml(b.cnicId || "-")}</td>
            </tr>
            <tr>
              <td class="label">Nationality</td>
              <td class="value">${escapeHtml(b.nationality || "Pakistani")}</td>
            </tr>
            <tr>
              <td class="label">Ownership Type</td>
              <td class="value">${escapeHtml(b.ownershipType || "Individual")}</td>
            </tr>
            <tr>
              <td class="label">Ownership Percentage</td>
              <td class="value">${escapeHtml(b.ownershipPercent || "100%")}</td>
            </tr>
          </table>
        </div>

        <div>
          <div class="section-title" style="background: transparent; border-bottom: 2px solid #2563eb; color: #0f172a; padding-left: 0; border-radius: 0; margin-top: 1px; font-weight: 800;">
            <span>Contact Information</span>
          </div>
          <table class="info-table" style="margin-top: 3px;">
            <tr>
              <td class="label">Mobile / Phone</td>
              <td class="value" style="color: #2563eb;">📞 ${escapeHtml(b.ownerPhone || "-")}</td>
            </tr>
            <tr>
              <td class="label">WhatsApp</td>
              <td class="value" style="color: #16a34a;">💬 ${escapeHtml(b.ownerWhatsApp || "-")}</td>
            </tr>
            <tr>
              <td class="label">Email</td>
              <td class="value" style="color: #2563eb; font-size: 9px;">✉ ${escapeHtml(b.ownerEmail || "-")}</td>
            </tr>
            <tr>
              <td class="label">Alternate Email</td>
              <td class="value" style="font-size: 9px;">${escapeHtml(b.ownerAltEmail || "-")}</td>
            </tr>
            <tr>
              <td class="label">Landline</td>
              <td class="value">${escapeHtml(b.ownerLandline || "-")}</td>
            </tr>
            <tr>
              <td class="label">Website</td>
              <td class="value">${escapeHtml(b.ownerWebsite || "-")}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Section 4: Company Details -->
      <div class="grid-2">
        <div>
          <div class="section-title">
            <span class="section-num">4</span>
            <span>${t(lang, "ledger.company_details")}</span>
          </div>
          <table class="info-table">
            <tr>
              <td class="label">${t(lang, "ledger.company_name")}</td>
              <td class="value">${escapeHtml(b.companyName || "-")}</td>
            </tr>
            <tr>
              <td class="label">Company Code</td>
              <td class="value">${escapeHtml(b.companyCode || "-")}</td>
            </tr>
            <tr>
              <td class="label">${t(lang, "ledger.account_type")}</td>
              <td class="value">${escapeHtml(b.companyType || "Private Limited")}</td>
            </tr>
            <tr>
              <td class="label">Registration No.</td>
              <td class="value">${escapeHtml(b.companyRegNo || "-")}</td>
            </tr>
            <tr>
              <td class="label">Incorporation Date</td>
              <td class="value">${escapeHtml(b.companyIncDate || "-")}</td>
            </tr>
            <tr>
              <td class="label">Tax Registration No.</td>
              <td class="value">${escapeHtml(b.companyTaxRegNo || "-")}</td>
            </tr>
            <tr>
              <td class="label">N.T.N / G.S.T No.</td>
              <td class="value">${escapeHtml(b.companyNtnGstNo || "-")}</td>
            </tr>
            <tr>
              <td class="label">Company Status</td>
              <td class="value" style="color: #16a34a;">${escapeHtml(b.companyStatus || "Active")}</td>
            </tr>
          </table>
        </div>

        <div>
          <div class="section-title" style="background: transparent; border-bottom: 2px solid #2563eb; color: #0f172a; padding-left: 0; border-radius: 0; margin-top: 1px; font-weight: 800;">
            <span>Company Contact</span>
          </div>
          <table class="info-table" style="margin-top: 3px;">
            <tr>
              <td class="label">Phone</td>
              <td class="value" style="color: #2563eb;">📞 ${escapeHtml(b.companyPhone || "-")}</td>
            </tr>
            <tr>
              <td class="label">Email</td>
              <td class="value" style="color: #2563eb; font-size: 9px;">✉ ${escapeHtml(b.companyEmail || "-")}</td>
            </tr>
            <tr>
              <td class="label">Website</td>
              <td class="value" style="color: #2563eb; font-size: 9px;">🌐 ${escapeHtml(b.companyWebsite || "-")}</td>
            </tr>
            <tr>
              <td class="label" style="vertical-align: top;">Office Address</td>
              <td class="value" style="line-height: 1.3;">📍 ${escapeHtml(b.companyOfficeAddress || "-")}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Section 5: Permissions & Access Rights -->
      <div class="grid-1" style="margin-bottom: 15px;">
        <div>
          <div class="section-title">
            <span class="section-num">5</span>
            <span>Branch Permissions & Access Rights</span>
          </div>
          <div class="permissions-grid">
            ${permissionItemsHtml}
          </div>
          <div class="perm-legend">
            <span><span class="perm-icon allowed" style="display: inline-flex; width: 10px; height: 10px; font-size: 6px; margin-right: 3px; vertical-align: middle;">✓</span> Allowed</span>
            <span><span class="perm-icon not-allowed" style="display: inline-flex; width: 10px; height: 10px; font-size: 6px; margin-right: 3px; vertical-align: middle;">✗</span> Not Allowed</span>
            <span><span class="perm-icon" style="display: inline-flex; width: 10px; height: 10px; font-size: 6px; margin-right: 3px; vertical-align: middle; background: #e2b714;">!</span> Partial Access</span>
          </div>
        </div>
      </div>

      <!-- Footer Signatures, Remarks & Gold Seal -->
      <div class="footer-signatures">
        <div class="notes-box">
          <strong style="color: #0f172a; font-size: 9px; display: block; margin-bottom: 2px;">${t(lang, "form.remarks_notes")}</strong>
          <span style="font-size: 8px;">${escapeHtml(b.remarks || "This is the branch profile summary report. All operations are managed under this branch's authorized scopes.")}</span>
        </div>
        
        <!-- Premium Gold Badge Seal -->
        <div class="seal-box">
          <svg width="65" height="65" viewBox="0 0 100 100">
            <!-- Ribbon -->
            <path d="M35 50 L25 85 L50 75 L75 85 L65 50 Z" fill="#d97706" />
            <path d="M45 50 L40 90 L50 82 L60 90 L55 50 Z" fill="#b45309" />
            <!-- Outer Ring -->
            <circle cx="50" cy="45" r="35" fill="url(#goldGrad)" stroke="#f59e0b" stroke-width="2" />
            <circle cx="50" cy="45" r="30" fill="none" stroke="#d97706" stroke-width="1" stroke-dasharray="3,3" />
            <!-- Typography -->
            <text x="50" y="38" font-family="'Inter', sans-serif" font-size="7" font-weight="900" text-anchor="middle" fill="#78350f" letter-spacing="0.2">VERIFIED</text>
            <text x="50" y="46" font-family="'Inter', sans-serif" font-size="5" font-weight="800" text-anchor="middle" fill="#92400e">VERIFIED</text>
            <text x="50" y="55" font-family="'Inter', sans-serif" font-size="6" font-weight="900" text-anchor="middle" fill="#78350f" letter-spacing="0.2">AUTHORIZED</text>
            
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fef3c7" />
                <stop offset="50%" stop-color="#fbbf24" />
                <stop offset="100%" stop-color="#f59e0b" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div class="sig-box">
          <div class="sig-line">Super Admin</div>
          <div style="font-size: 8px; font-weight: 700; color: #64748b;">Super Admin</div>
          <div style="font-size: 7px; color: #94a3b8; font-weight: 500;">Enterprise Administrator</div>
        </div>
      </div>

      <!-- Page Footer -->
      <div class="page-footer">
        <div>🏢 ACCOUNTS.DGT.LLC | Enterprise ERP / FMS</div>
        <div>✉ Email: ${escapeHtml(b.companyEmail || "info@dgt.llc")}</div>
        <div>Report ID: BR-${escapeHtml(b.branchCode || "MAIN")}-${stampDate.replace(/-/g, "")}</div>
        <div>Page 1 of 1</div>
      </div>
    `;
  } else if (input.cashEntryData) {
    const c = input.cashEntryData;
    const showUsdCols = Boolean(c.showUsdReporting);
    const fmtM = (n: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    const linesHtml = (c.financialLines || []).map((l, i) => `
      <tr>
        <td style="text-align: center; font-mono; font-size: 10px;">${i + 1}</td>
        <td>
          <div style="font-weight: 800; color: #0f172a; font-size: 11px;">${escapeHtml(l.description || "Cash Entry Line")}</div>
          <div style="font-size: 9px; color: #64748b; font-family: monospace;">${escapeHtml(l.accountCode || "-")} · ${escapeHtml(l.accountName || "-")}</div>
        </td>
        <td style="text-align: center; font-family: monospace; font-size: 10px; font-weight: 700;">${escapeHtml(l.currency || c.currency || "AED")}</td>
        <td style="text-align: right; font-family: monospace; font-size: 11px; font-weight: 800; color: ${l.debit ? '#e11d48' : '#94a3b8'};">
          ${l.debit ? fmtM(l.debit) : "—"}
        </td>
        <td style="text-align: right; font-family: monospace; font-size: 11px; font-weight: 800; color: ${l.credit ? '#16a34a' : '#94a3b8'};">
          ${l.credit ? fmtM(l.credit) : "—"}
        </td>
        ${showUsdCols ? `
          <td style="text-align: center; font-family: monospace; font-size: 10px; color: #64748b;">${Number(l.exchangeRate || 1).toFixed(4)}</td>
          <td style="text-align: right; font-family: monospace; font-size: 11px; font-weight: 800; color: #0f172a;">
            ${l.convertedAmount ? "$" + fmtM(l.convertedAmount) : "—"}
          </td>
        ` : ""}
      </tr>
    `).join("");

    contentHtml = `
      <!-- Header Block -->
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: #2563eb; color: #fff; font-weight: 900; padding: 4px 8px; border-radius: 4px; font-size: 12px; letter-spacing: 0.5px;">
                ${escapeHtml(c.companyName || "DGT LLC")}
              </span>
              <span style="font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
                Roznamcha Cash Entry
              </span>
            </div>
            <div style="font-size: 10px; color: #64748b; font-weight: 600; margin-top: 4px;">
              Enterprise Official Cash & Bank Transaction Voucher
            </div>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 3px 8px; border-radius: 999px;">
              ${escapeHtml(c.status || "POSTED")}
            </div>
            <div style="font-size: 9px; color: #64748b; font-weight: 600; margin-top: 4px;">
              Printed: ${escapeHtml(stampDate + " · " + stampTime)}
            </div>
          </div>
        </div>
      </div>

      <!-- Voucher Metadata Bar -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
        <div>
          <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #64748b;">Voucher Number</div>
          <div style="font-size: 12px; font-family: monospace; font-weight: 900; color: #2563eb; margin-top: 2px;">${escapeHtml(c.voucherNo || "-")}</div>
        </div>
        <div>
          <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #64748b;">Journal Number</div>
          <div style="font-size: 12px; font-family: monospace; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(c.journalNo || "-")}</div>
        </div>
        <div>
          <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #64748b;">Entry Serial</div>
          <div style="font-size: 12px; font-family: monospace; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(c.entrySerial || "-")}</div>
        </div>
        <div>
          <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #64748b;">Transaction Date</div>
          <div style="font-size: 12px; font-family: monospace; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(c.entryDate || "-")}</div>
        </div>
      </div>

      <!-- Customer / Counterparty & Account Information Card -->
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; overflow: hidden;">
        <div style="background: #f1f5f9; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #334155;">
          Customer & Account Information
        </div>
        <div style="padding: 10px 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 10px;">
          <div>
            <div style="margin-bottom: 6px;">
              <span style="color: #64748b; font-weight: 600;">Customer / Counterparty: </span>
              <strong style="color: #0f172a; font-size: 11px;">${escapeHtml(c.counterpartyName || "-")}</strong>
            </div>
            <div style="margin-bottom: 6px;">
              <span style="color: #64748b; font-weight: 600;">Account Code / No: </span>
              <span style="font-family: monospace; font-weight: 800; color: #2563eb;">${escapeHtml(c.counterpartyCode || "-")} ${c.accountNo ? `(${escapeHtml(c.accountNo)})` : ""}</span>
            </div>
            <div>
              <span style="color: #64748b; font-weight: 600;">Payment Method: </span>
              <strong style="color: #0f172a;">${escapeHtml(c.paymentMethod || "Cash")}</strong>
            </div>
          </div>
          <div>
            <div style="margin-bottom: 6px;">
              <span style="color: #64748b; font-weight: 600;">Country / Territory: </span>
              <strong style="color: #0f172a;">${escapeHtml(c.country || "-")}</strong>
            </div>
            <div style="margin-bottom: 6px;">
              <span style="color: #64748b; font-weight: 600;">Branch Name: </span>
              <strong style="color: #0f172a;">${escapeHtml(c.branch || "-")}</strong>
            </div>
            <div>
              <span style="color: #64748b; font-weight: 600;">Bank / Cash Account: </span>
              <strong style="color: #0f172a;">${escapeHtml(c.bankName || "-")}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Financial Information Table -->
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; overflow: hidden;">
        <div style="background: #f1f5f9; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #334155;">
          Financial Breakdown & Line Details
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead style="background: #fafafa; border-bottom: 1px solid #e2e8f0;">
            <tr>
              <th style="padding: 6px 8px; width: 5%; text-align: center; font-size: 9px;">#</th>
              <th style="padding: 6px 8px; width: ${showUsdCols ? '35%' : '47%'}; text-align: left; font-size: 9px;">Description / Account</th>
              <th style="padding: 6px 8px; width: ${showUsdCols ? '8%' : '12%'}; text-align: center; font-size: 9px;">Curr</th>
              <th style="padding: 6px 8px; width: ${showUsdCols ? '14%' : '18%'}; text-align: right; font-size: 9px; color: #e11d48;">Debit</th>
              <th style="padding: 6px 8px; width: ${showUsdCols ? '14%' : '18%'}; text-align: right; font-size: 9px; color: #16a34a;">Credit</th>
              ${showUsdCols ? `
                <th style="padding: 6px 8px; width: 10%; text-align: center; font-size: 9px;">Rate</th>
                <th style="padding: 6px 8px; width: 14%; text-align: right; font-size: 9px;">Converted (USD)</th>
              ` : ""}
            </tr>
          </thead>
          <tbody style="divide-y: 1px solid #f1f5f9;">
            ${linesHtml}
          </tbody>
          <tfoot style="background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 800;">
            <tr>
              <td colspan="3" style="padding: 8px 10px; text-align: right; text-transform: uppercase; font-size: 9px; color: #475569;">
                Totals & Net Balance
              </td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 11px; font-weight: 900; color: #e11d48;">
                ${fmtM(c.totalDebit || 0)}
              </td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace; font-size: 11px; font-weight: 900; color: #16a34a;">
                ${fmtM(c.totalCredit || 0)}
              </td>
              <td colspan="${showUsdCols ? '2' : '1'}" style="padding: 8px 10px; text-align: right;">
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                  <span style="font-size: 8px; text-transform: uppercase; color: #64748b;">Final:</span>
                  <span style="font-family: monospace; font-size: 12px; font-weight: 900; color: #2563eb;">
                    ${escapeHtml(c.currency || "AED")} ${fmtM(c.finalBalance || 0)}
                  </span>
                  <span style="background: ${c.balanceDirection === 'DR' ? '#ffe4e6' : c.balanceDirection === 'CR' ? '#dcfce7' : '#f1f5f9'}; color: ${c.balanceDirection === 'DR' ? '#be123c' : c.balanceDirection === 'CR' ? '#15803d' : '#475569'}; font-size: 9px; font-weight: 900; padding: 1px 5px; border-radius: 4px;">
                    ${escapeHtml(c.balanceDirection || "—")}
                  </span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Separate Narration Section -->
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 18px; overflow: hidden;">
        <div style="background: #f1f5f9; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #334155;">
          Transaction Narration & Remarks
        </div>
        <div style="padding: 10px 12px; font-size: 10.5px; line-height: 1.4; color: #1e293b; background: #ffffff;">
          ${escapeHtml(c.narration || "No additional narration provided.")}
        </div>
      </div>

      <!-- Verification, Signatures & Footer -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 15px; border-top: 1px solid #e2e8f0;">
        <div style="width: 32%;">
          <div style="border-bottom: 1px solid #94a3b8; height: 32px; display: flex; align-items: flex-end; justify-content: center; font-size: 10px; font-weight: 700; color: #334155;">
            ${escapeHtml(c.createdBy || "Authorized Officer")}
          </div>
          <div style="font-size: 8px; color: #64748b; text-align: center; margin-top: 3px; font-weight: 600; text-transform: uppercase;">
            Prepared By
          </div>
        </div>

        <div style="text-align: center; width: 30%;">
          <div style="display: inline-block; border: 1.5px dashed #059669; border-radius: 6px; padding: 4px 10px; background: #ecfdf5;">
            <div style="font-size: 8px; font-weight: 900; color: #059669; letter-spacing: 0.5px;">OFFICIALLY VERIFIED</div>
            <div style="font-size: 7px; color: #065f46; font-family: monospace;">ACCOUNTS.DGT.LLC</div>
          </div>
        </div>

        <div style="width: 32%;">
          <div style="border-bottom: 1px solid #94a3b8; height: 32px; display: flex; align-items: flex-end; justify-content: center; font-size: 10px; font-weight: 700; color: #334155;">
            ${escapeHtml(c.approvedBy || "Finance Manager")}
          </div>
          <div style="font-size: 8px; color: #64748b; text-align: center; margin-top: 3px; font-weight: 600; text-transform: uppercase;">
            Authorized & Approved By
          </div>
        </div>
      </div>

      <!-- Page Footer -->
      <div class="page-footer" style="margin-top: 15px;">
        <div>🏢 ACCOUNTS.DGT.LLC | Cash & Bank Roznamcha</div>
        <div>Voucher: ${escapeHtml(c.voucherNo || "-")}</div>
        <div>Doc Ref: RZN-${escapeHtml(c.entrySerial || "0001")}</div>
        <div>Page 1 of 1</div>
      </div>
    `;
  } else {
    // Fallback to legacy row listing
    const rowsHtml = (input.rows || [])
      .filter((r) => r && (r.label || r.value))
      .map(
        (r) => `
          <tr>
            <th>${escapeHtml(t(lang, r.label))}</th>
            <td>${escapeHtml(r.value || "-")}</td>
          </tr>
        `
      )
      .join("");

    contentHtml = `
      <div class="head">
        <h1 class="title">${title}</h1>
        ${subtitle ? `<div class="sub">${subtitle}</div>` : ""}
        <div class="meta">
          <span class="pill">Generated: ${escapeHtml(stampDate + " " + stampTime)}</span>
        </div>
      </div>
      <div class="content">
        <table>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      @page { size: A4; margin: 12mm; orphans: 3; widows: 3; }
      html, body { height: 100%; margin: 0; padding: 0; }
      body { background: #f1f5f9; color: #1e293b; font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; direction: ltr; }
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
      .head { padding: 18px 22px; border-bottom: 1px solid #e5e7eb; }
      .title { font-size: 20px; font-weight: 800; margin: 0; }
      .sub { margin-top: 6px; color: #6b7280; font-size: 12px; }
      .meta { margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap; color: #6b7280; font-size: 12px; }
      .pill { border: 1px solid #e5e7eb; border-radius: 999px; padding: 4px 10px; background: #f9fafb; }
      .content { padding: 18px 22px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #e5e7eb; padding: 10px 12px; font-size: 13px; text-align: left; vertical-align: top; word-wrap: break-word; word-break: break-word; overflow-wrap: break-word; }
      th { width: 32%; background: #f9fafb; color: #374151; font-weight: 700; }
      td { font-weight: 600; }
      tr { page-break-inside: avoid !important; break-inside: avoid !important; }

      /* Branch data premium templates styling */
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
      .header-table td { border: none; padding: 0; }
      .logo-title { display: flex; align-items: center; gap: 10px; }
      .logo-icon { width: 36px; height: 36px; background: #2563eb; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; }
      .logo-text { font-size: 14px; font-weight: 900; color: #0f172a; line-height: 1.1; }
      .logo-subtext { font-size: 8px; color: #64748b; font-weight: 600; line-height: 1.2; }
      .report-title { font-size: 16px; font-weight: 900; color: #1e3a8a; margin: 0 0 4px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; }
      .meta-box { font-size: 9px; color: #334155; font-weight: 700; line-height: 1.4; text-align: right; }
      .meta-label { color: #64748b; font-weight: 500; }
      .kpi-row { display: flex; gap: 8px; margin-bottom: 16px; }
      .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; background: #ffffff; display: flex; align-items: center; gap: 8px; }
      .kpi-icon-container { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 1px solid #cbd5e1; flex-shrink: 0; }
      .kpi-content { display: flex; flex-direction: column; }
      .kpi-label { font-size: 7px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
      .kpi-value { font-size: 9.5px; font-weight: 900; color: #0f172a; margin-top: 1px; }
      .section-title { bg-color: #2563eb; background: #2563eb; color: white; font-size: 9px; font-weight: 800; text-transform: uppercase; padding: 5px 10px; border-radius: 4px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px; }
      .section-num { background: rgba(255, 255, 255, 0.25); width: 14px; height: 14px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 12px; }
      .grid-1 { display: grid; grid-template-columns: 1fr; margin-bottom: 12px; }
      .info-table { width: 100%; border-collapse: collapse; }
      .info-table td { padding: 4.5px 6px; font-size: 9.5px; border-bottom: 1px solid #e2e8f0; border: none; border-bottom: 1px solid #f1f5f9; }
      .info-table td.label { color: #64748b; font-weight: 600; width: 42%; }
      .info-table td.value { font-weight: 700; color: #1e293b; text-align: left; }
      .owner-card { display: flex; gap: 10px; align-items: center; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; background: #f8fafc; }
      .avatar-box { width: 36px; height: 36px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #475569; font-size: 16px; border: 1.5px solid #cbd5e1; }
      .permissions-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px; }
      .perm-item { display: flex; align-items: center; gap: 6px; font-size: 8.5px; font-weight: 600; color: #334155; }
      .perm-icon { width: 11px; height: 11px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 900; color: white; flex-shrink: 0; }
      .perm-icon.allowed { background: #10b981; }
      .perm-icon.not-allowed { background: #ef4444; }
      .perm-legend { display: flex; gap: 12px; justify-content: center; font-size: 8px; font-weight: 800; margin-top: 5px; color: #64748b; }
      .hierarchy-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; }
      .hierarchy-title { font-size: 8px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; }
      .hierarchy-steps { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .hierarchy-step-card { background: white; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; display: flex; flex-direction: column; min-width: 140px; box-sizing: border-box; }
      .hierarchy-step-type { font-size: 6.5px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 0.3px; }
      .hierarchy-step-name { font-size: 9.5px; font-weight: 800; color: #0f172a; margin-top: 1px; }
      .hierarchy-step-code { font-size: 7.5px; color: #64748b; font-weight: 600; margin-top: 0.5px; }
      .hierarchy-arrow { color: #94a3b8; font-size: 13px; font-weight: bold; margin: 0 2px; }
      .footer-signatures { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 10px; border-top: 1px solid #e2e8f0; }
      .notes-box { width: 45%; font-size: 8.5px; color: #64748b; line-height: 1.3; }
      .seal-box { text-align: center; }
      .sig-box { width: 30%; text-align: center; font-size: 9px; }
      .sig-line { border-bottom: 1px solid #94a3b8; margin-bottom: 4px; height: 22px; display: flex; align-items: flex-end; justify-content: center; font-family: 'Georgia', serif; font-style: italic; color: #0f172a; font-size: 11px; }
      .page-footer { display: flex; justify-content: space-between; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 10px; font-weight: 700; }

      /* RTL direction specific layouts */
      html[dir="rtl"] body { text-align: right; direction: rtl; }
      html[dir="rtl"] th, html[dir="rtl"] td { text-align: right; }
      html[dir="rtl"] .info-table td.value { text-align: right; }
      html[dir="rtl"] .meta-box { text-align: left; }
      html[dir="rtl"] .logo-title { flex-direction: row-reverse; }
      html[dir="rtl"] .hierarchy-steps { flex-direction: row-reverse; }
      html[dir="rtl"] .kpi-row { flex-direction: row-reverse; }
      html[dir="rtl"] .owner-card { flex-direction: row-reverse; }
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
        ${contentHtml}
      </div>
    </div>
  </body>
</html>`;

  // Render into the shared in-app PdfPreviewModal. The user drives Print /
  // Save-as-PDF from the modal toolbar — an embedded `window.print()` here would
  // fire *inside the preview iframe* and freeze the renderer, so `autoPrint` is
  // intentionally a no-op now that this never opens a standalone window.
  void input.autoPrint;
  printStore.openPrint(html, input.title);
}

