import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { buildRbacRoleSummary } from "@/lib/permissions/rbac-matrix-builder";
import type { EnterpriseRole } from "@/lib/permissions/enterprise-roles";

export type UserReportData = {
  userId: string;
  userCode: string;
  fullName: string;
  countryName: string;
  branchName: string;
  branchCode?: string | null;
  branchType: string;
  role: string;
  registrationDate: string;
  status: string;
  permissions?: string[];
  lastActivity?: string;
  lastActivityAction?: string | null;
  rawPassword?: string | null;
  department?: string;
  designation?: string;
  employeeCode?: string;
  phone?: string;
  email?: string;
  cnicPassportNo?: string;
  idExpiryDate?: string;
  kycStatus?: string;
  residentialAddress?: string;
  passwordVaultRef?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  activityCounts?: {
    logins?: number;
    transactions?: number;
    roznamcha?: number;
    purchases?: number;
    payments?: number;
    accounts?: number;
    approvals?: number;
    edits?: number;
  };
};

function escapeHtml(value: string | undefined | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | undefined | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  
  const day = String(date.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

const reportI18n = {
  en: {
    orgTitle: "ACCOUNTS.DGT.LLC ENTERPRISE RESOURCE PLANNING",
    reportTitle: "OFFICIAL USER ACCESS & REGISTRATION REPORT",
    confidential: "CONFIDENTIAL & SYSTEM RESTRICTED",
    empDetails: "1. EMPLOYEE & CONTACT DETAILS",
    geoScope: "2. GEOGRAPHIC & BRANCH ACCESS SCOPE",
    secCred: "3. SECURITY & CREDENTIAL VAULT",
    rbacMatrix: "4. ROLES & PERMISSIONS AUTHORIZATION MATRIX",
    superPriv: "Supervisor & Admin Privileges",
    restrMod: "Restricted Modules (No Access)",
    auditTrail: "5. AUDIT TRAIL & SYSTEM SIGN-OFF",
    empSign: "Employee Acknowledgment",
    managerSign: "Branch Manager Approval",
    adminSign: "System Admin Authorization",
    vaultNotice: "SECURITY POLICY: Passwords are protected in the Enterprise Credential Vault. Plaintext passwords are not exported."
  },
  ur: {
    orgTitle: "اکاؤنٹس ڈی جی ٹی ایل ایل سی انٹرپرائز ریسورس پلاننگ",
    reportTitle: "سرکاری صارف رسائی اور رجسٹریشن رپورٹ",
    confidential: "خفیہ اور سسٹم کے زیر انتظام",
    empDetails: "1. ملازم اور رابطہ کی تفصیلات",
    geoScope: "2. جغرافیائی اور برانچ کے اختیارات",
    secCred: "3. سیکیورٹی اور کریڈینشل والٹ",
    rbacMatrix: "4. کردار اور اختیارات کی مجاز میٹرکس (RBAC)",
    superPriv: "نگران اور منظوری کے خصوصی اختیارات",
    restrMod: "ممنوعہ ماڈیولز (کوئی رسائی نہیں)",
    auditTrail: "5. آڈٹ ٹریل اور دستخط کی منظوری",
    empSign: "ملازم کی تصدیق و دستخط",
    managerSign: "برانچ مینیجر کی منظوری",
    adminSign: "سسٹم ایڈمنسٹریٹر کی اجازت",
    vaultNotice: "سیکیورٹی پالیسی: پاس ورڈز کو والٹ میں محفوظ رکھا جاتا ہے۔ سیکیورٹی وجوہات پر پاس ورڈ ظاہر نہیں کیا جاتا۔"
  },
  ar: {
    orgTitle: "تخطيط موارد المؤسسات - ACCOUNTS.DGT.LLC",
    reportTitle: "تقرير تسجيل وصلاحيات وصول المستخدم الرسمي",
    confidential: "سري ومقيد بالنظام",
    empDetails: "1. تفاصيل الموظف وبيانات الاتصال",
    geoScope: "2. النطاق الجغرافي وصلاحيات الفروع",
    secCred: "3. الأمان وخزينة بيانات الاعتماد",
    rbacMatrix: "4. مصفوفة الأدوار والصلاحيات المعتمدة (RBAC)",
    superPriv: "امتيازات المشرف والموافقات الخاصة",
    restrMod: "الوحدات المقيدة (لا يوجد وصول)",
    auditTrail: "5. سجل التدقيق والاعتماد النهائي",
    empSign: "إقرار وتوقيع الموظف",
    managerSign: "موافقة مدير الفرع",
    adminSign: "اعتماد مسؤول النظام",
    vaultNotice: "سياسة الأمان: كلمات المرور محمية في خزينة بيانات الاعتماد ولا يتم تصديرها كنص صريح."
  },
  fa: {
    orgTitle: "سیستم جامع مدیریت سازمانی - ACCOUNTS.DGT.LLC",
    reportTitle: "گزارش رسمی ثبت‌نام و مجوزهای دسترسی کاربر",
    confidential: "محرمانه و تحت نظارت سیستم",
    empDetails: "۱. مشخصات پرسنل و اطلاعات تماس",
    geoScope: "۲. محدوده جغرافیایی و دسترسی شعب",
    secCred: "۳. امنیت و شناسه مخزن اعتبار",
    rbacMatrix: "۴. ماتریس نقش‌ها و مجوزهای مجاز (RBAC)",
    superPriv: "امتیازات سرپرست و تاییدیه‌های ویژه",
    restrMod: "بخش‌های محدود شده (بدون دسترسی)",
    auditTrail: "۵. ردپای حسابرسی و تاییدات نهایی",
    empSign: "امضا و تایید پرسنل",
    managerSign: "تایید مدیر شعبه",
    adminSign: "تایید مدیر ارشد سیستم",
    vaultNotice: "خط‌مشی امنیتی: گذرواژه‌ها در مخزن امن محافظت می‌شوند و متن آشکار ذخیره نمی‌شود."
  },
  ps: {
    orgTitle: "د تشبث د سرچینو پلان جوړونه - ACCOUNTS.DGT.LLC",
    reportTitle: "د کارونکي لاسرسي او راجستر کولو رسمي راپور",
    confidential: "محرم او د سیسټم لخوا محدود شوی",
    empDetails: "۱. د کارمند او اړیکې تفصیلي معلومات",
    geoScope: "۲. جغرافیایي او د څانګې د لاسرسي ساحه",
    secCred: "۳. امنیت او د اسنادو خوندي والټ",
    rbacMatrix: "۴. د رولونو او واکونو تایید شوې جدول (RBAC)",
    superPriv: "د څارونکي او تصویب ځانګړي واکونه",
    restrMod: "محدود شوي ماډلونه (هیڅ لاسرسی نشته)",
    auditTrail: "۵. د پلټنې تاریخچه او رسمي لاسلیکونه",
    empSign: "د کارمند تایید او لاسلیک",
    managerSign: "د څانګې د مدیر تایید",
    adminSign: "د سیسټم د اداري مدیر تایید",
    vaultNotice: "امنیتي پالیسي: پټنوم په خوندي والټ کې ساتل کیږي او په فایل کې ښکاره نه راځي."
  }
};

export function openUserA4ReportWindow(input: {
  title?: string;
  subtitle?: string;
  autoPrint?: boolean;
  userData: UserReportData;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const loc = reportI18n[lang] || reportI18n.en;

  const now = new Date();
  const stampDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  const u = input.userData;
  const role = (u.role || "staff_user") as EnterpriseRole;
  const rbac = buildRbacRoleSummary(role, u.permissions);

  const htmlContent = `
<!DOCTYPE html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(u.fullName)} - ${escapeHtml(u.userCode)} User Access Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 12mm 12mm 12mm;
      @bottom-right {
        content: "Page " counter(page);
        font-size: 8pt;
        font-family: 'Inter', sans-serif;
        color: #64748b;
      }
      @bottom-left {
        content: "${loc.confidential} — ACCOUNTS.DGT.LLC";
        font-size: 8pt;
        font-family: 'Inter', sans-serif;
        color: #dc2626;
        font-weight: 600;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 8pt;
      line-height: 1.4;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }

    .header-box {
      border: 1px solid #1e293b;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-size: 13pt;
      font-weight: 800;
      margin: 0 0 2px 0;
      letter-spacing: -0.3px;
    }

    .subtitle {
      font-size: 7.5pt;
      color: #cbd5e1;
    }

    .badge-code {
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      font-weight: 700;
      color: #38bdf8;
      text-align: right;
    }

    .section-title {
      font-size: 8.5pt;
      font-weight: 800;
      color: #1e293b;
      background: #f1f5f9;
      border-left: 4px solid #2563eb;
      padding: 4px 8px;
      margin: 8px 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    [dir="rtl"] .section-title {
      border-left: none;
      border-right: 4px solid #2563eb;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }

    .info-card {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 8px;
      background: #fafafa;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      font-size: 7.5pt;
      border-bottom: 1px dashed #f1f5f9;
    }

    .info-label {
      color: #64748b;
      font-weight: 500;
    }

    .info-val {
      color: #0f172a;
      font-weight: 700;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7pt;
      margin: 4px 0 8px 0;
    }

    th {
      background: #f8fafc;
      color: #1e293b;
      font-weight: 700;
      padding: 4px 6px;
      border: 1px solid #cbd5e1;
      text-align: left;
      font-size: 6.8pt;
      text-transform: uppercase;
    }

    [dir="rtl"] th {
      text-align: right;
    }

    td {
      padding: 4px 6px;
      border: 1px solid #e2e8f0;
      color: #334155;
      vertical-align: middle;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    .check-yes {
      color: #16a34a;
      font-weight: 800;
      text-align: center;
    }

    .check-no {
      color: #cbd5e1;
      text-align: center;
    }

    .tag {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 6.5pt;
      font-weight: 700;
      background: #e2e8f0;
      color: #334155;
    }

    .tag-restricted {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
    }

    .tag-active {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }

    .sign-box-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
    }

    .sign-box {
      border: 1px dashed #94a3b8;
      border-radius: 4px;
      padding: 6px;
      height: 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #f8fafc;
    }

    .sign-label {
      font-size: 6.8pt;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
    }

    .sign-line {
      border-bottom: 1px solid #64748b;
      margin-top: 18px;
    }

    .policy-note {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 6.8pt;
      color: #1e40af;
      margin-top: 6px;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header-box">
    <div>
      <div class="title">${loc.orgTitle}</div>
      <div class="subtitle">${loc.reportTitle} — ${loc.confidential}</div>
    </div>
    <div class="badge-code">
      <div>${escapeHtml(u.userCode)}</div>
      <div style="font-size: 6.5pt; font-weight: normal; color: #cbd5e1; margin-top: 2px;">${stampDate} ${stampTime}</div>
    </div>
  </div>

  <!-- Section 1 & 2: Employee & Geographic Scope -->
  <div class="grid-2">
    <!-- Employee Details -->
    <div>
      <div class="section-title">${loc.empDetails}</div>
      <div class="info-card">
        <div class="info-row"><span class="info-label">Full Name:</span><span class="info-val">${escapeHtml(u.fullName)}</span></div>
        <div class="info-row"><span class="info-label">Designation:</span><span class="info-val">${escapeHtml(u.designation || u.branchType || "Staff")}</span></div>
        <div class="info-row"><span class="info-label">Department:</span><span class="info-val">${escapeHtml(u.department || "General Office")}</span></div>
        <div class="info-row"><span class="info-label">Phone / WhatsApp:</span><span class="info-val">${escapeHtml(u.phone || "-")}</span></div>
        <div class="info-row"><span class="info-label">Personal Email:</span><span class="info-val">${escapeHtml(u.email || "-")}</span></div>
      </div>
    </div>

    <!-- Geographic & Branch Scope -->
    <div>
      <div class="section-title">${loc.geoScope}</div>
      <div class="info-card">
        <div class="info-row"><span class="info-label">Country Scope:</span><span class="info-val">${escapeHtml(u.countryName || "Global Scope")}</span></div>
        <div class="info-row"><span class="info-label">Branch Name:</span><span class="info-val">${escapeHtml(u.branchName || "Main Branch")}</span></div>
        <div class="info-row"><span class="info-label">Branch Code:</span><span class="info-val font-mono" style="color: #2563eb;">${escapeHtml(u.branchCode || "MAIN-001")}</span></div>
        <div class="info-row"><span class="info-label">Assigned Role:</span><span class="info-val" style="text-transform: uppercase;">${escapeHtml(u.role)}</span></div>
        <div class="info-row"><span class="info-label">Account Status:</span><span class="tag tag-active">${escapeHtml(u.status || "Active")}</span></div>
      </div>
    </div>
  </div>

  <!-- Section 3: Security & Credentials -->
  <div class="section-title">${loc.secCred}</div>
  <div class="grid-3">
    <div class="info-card">
      <div class="info-row"><span class="info-label">Login Identifier:</span><span class="info-val font-mono">${escapeHtml(u.userCode)}</span></div>
      <div class="info-row"><span class="info-label">Vault Credential Ref:</span><span class="info-val font-mono" style="color: #7c3aed;">${escapeHtml(u.passwordVaultRef || `VAULT-DGT-${u.userCode}`)}</span></div>
    </div>
    <div class="info-card">
      <div class="info-row"><span class="info-label">National ID / Passport:</span><span class="info-val font-mono">${escapeHtml(u.cnicPassportNo || "Verified")}</span></div>
      <div class="info-row"><span class="info-label">Document Expiry:</span><span class="info-val">${formatDate(u.idExpiryDate)}</span></div>
    </div>
    <div class="info-card">
      <div class="info-row"><span class="info-label">KYC Verification:</span><span class="info-val" style="color: #16a34a;">${escapeHtml(u.kycStatus || "VERIFIED")}</span></div>
      <div class="info-row"><span class="info-label">Residential City:</span><span class="info-val">${escapeHtml(u.residentialAddress || u.countryName || "-")}</span></div>
    </div>
  </div>

  <!-- Section 4: Roles & Permissions Matrix -->
  <div class="section-title">${loc.rbacMatrix} (${rbac.roleTitle})</div>
  <table>
    <thead>
      <tr>
        <th style="width: 32%;">Module / ERP Function</th>
        <th style="width: 8%; text-align: center;">View</th>
        <th style="width: 8%; text-align: center;">Create</th>
        <th style="width: 8%; text-align: center;">Edit</th>
        <th style="width: 8%; text-align: center;">Delete</th>
        <th style="width: 12%; text-align: center;">Post/Approve</th>
        <th style="width: 10%; text-align: center;">Print/Export</th>
        <th style="width: 14%;">Authorization Scope</th>
      </tr>
    </thead>
    <tbody>
      ${rbac.accessibleModules.map(m => `
        <tr>
          <td><strong>${escapeHtml(m.moduleName)}</strong></td>
          <td class="${m.canView ? "check-yes" : "check-no"}">${m.canView ? "✓" : "-"}</td>
          <td class="${m.canCreate ? "check-yes" : "check-no"}">${m.canCreate ? "✓" : "-"}</td>
          <td class="${m.canEdit ? "check-yes" : "check-no"}">${m.canEdit ? "✓" : "-"}</td>
          <td class="${m.canDelete ? "check-yes" : "check-no"}">${m.canDelete ? "✓" : "-"}</td>
          <td class="${m.canPostApprove ? "check-yes" : "check-no"}">${m.canPostApprove ? "✓" : "-"}</td>
          <td class="${m.canPrintExport ? "check-yes" : "check-no"}">${m.canPrintExport ? "✓" : "-"}</td>
          <td style="font-size: 6.5pt;">${escapeHtml(m.notes)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Supervisor Privileges & Restricted Modules Summary -->
  <div class="grid-2">
    <div class="info-card" style="background: #f0fdf4; border-color: #bbf7d0;">
      <div style="font-weight: 700; color: #166534; margin-bottom: 3px; font-size: 7pt;">★ ${loc.superPriv}</div>
      <div style="font-size: 6.8pt; color: #1e293b;">
        ${rbac.supervisorPrivileges.length > 0 ? rbac.supervisorPrivileges.join(" • ") : "Standard branch operational authorization."}
      </div>
    </div>
    <div class="info-card" style="background: #fef2f2; border-color: #fecaca;">
      <div style="font-weight: 700; color: #991b1b; margin-bottom: 3px; font-size: 7pt;">✕ ${loc.restrMod}</div>
      <div style="font-size: 6.8pt; color: #7f1d1d;">
        ${rbac.restrictedModules.length > 0 ? rbac.restrictedModules.map(rm => `<span class="tag tag-restricted" style="margin-right: 3px;">${escapeHtml(rm)}</span>`).join('') : "None (Full Enterprise Root Scope)"}
      </div>
    </div>
  </div>

  <div class="policy-note">
    <strong>${loc.vaultNotice}</strong>
  </div>

  <!-- Section 5: Audit Trail & Sign-offs -->
  <div class="sign-box-grid">
    <div class="sign-box">
      <div class="sign-label">${loc.empSign}</div>
      <div style="font-size: 6.5pt; color: #64748b;">${escapeHtml(u.fullName)}</div>
      <div class="sign-line"></div>
    </div>
    <div class="sign-box">
      <div class="sign-label">${loc.managerSign}</div>
      <div style="font-size: 6.5pt; color: #64748b;">${escapeHtml(u.branchName || "Branch Head")}</div>
      <div class="sign-line"></div>
    </div>
    <div class="sign-box">
      <div class="sign-label">${loc.adminSign}</div>
      <div style="font-size: 6.5pt; color: #64748b;">DGT Enterprise Security Operations</div>
      <div class="sign-line"></div>
    </div>
  </div>

</body>
</html>
`;

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("Please allow popups to open the printable A4 report.");
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(htmlContent);
  reportWindow.document.close();

  if (input.autoPrint) {
    reportWindow.onload = () => {
      setTimeout(() => {
        reportWindow.print();
      }, 400);
    };
  }
}
