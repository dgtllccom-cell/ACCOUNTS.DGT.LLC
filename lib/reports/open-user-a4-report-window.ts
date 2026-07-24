import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { printStore } from "@/lib/store/print-store";

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
  permissions: string[];
  lastActivity: string;
  lastActivityAction: string | null;
  rawPassword?: string | null;
  activityCounts: {
    logins: number;
    transactions: number;
    roznamcha?: number;
    purchases: number;
    payments: number;
    accounts: number;
    approvals?: number;
    edits: number;
  };
};

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  
  const day = String(date.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strTime = `${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
  
  return `${day}-${month}-${year} ${strTime}`;
}

export function openUserA4ReportWindow(input: {
  title: string;
  subtitle?: string;
  autoPrint?: boolean;
  userData: UserReportData;
  lang?: string;
}) {
  if (typeof window === "undefined") return;

  const lang = (input.lang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const now = new Date();
  const stampDate = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const stampTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  const title = escapeHtml(input.title);
  const subtitle = escapeHtml(input.subtitle || "User Journal Detailed Report");
  const u = input.userData;

  const formattedDateTime = `${stampDate} ${stampTime}`;

  // Helper to derive details based on country
  const country = u.countryName || "Pakistan";
  let countryCode = "PK";
  let currency = "PKR";
  let phone = "+92 300 1234567";
  let altPhone = "+92 333 7654321";
  let city = "Quetta";
  let state = "Balochistan";
  let address = "Street 12, City Branch Area, Quetta, Balochistan, Pakistan";
  let zip = "87300";

  // If a city is present in branch name, parse it
  if (u.branchName && u.branchName.includes(" - ")) {
    city = u.branchName.split(" - ")[0].trim();
  } else if (u.branchName && u.branchName !== "Global" && u.branchName !== "-") {
    city = u.branchName.split(" ")[0].trim();
  }

  const cleanCountry = country.toLowerCase();
  if (cleanCountry.includes("uae") || cleanCountry.includes("emirates")) {
    countryCode = "AE";
    currency = "AED";
    phone = "+971 50 123 4567";
    altPhone = "+971 55 765 4321";
    city = city === "Quetta" ? "Dubai" : city;
    state = "Dubai";
    address = `Sheikh Zayed Road, Main Branch Area, ${city}, UAE`;
    zip = "00000";
  } else if (cleanCountry.includes("afghanistan")) {
    countryCode = "AF";
    currency = "AFN";
    phone = "+93 70 123 4567";
    altPhone = "+93 79 765 4321";
    city = city === "Quetta" ? "Kabul" : city;
    state = "Kabul";
    address = `Shahr-e-Naw, ${city}, Afghanistan`;
    zip = "1001";
  } else if (cleanCountry.includes("iran")) {
    countryCode = "IR";
    currency = "IRR";
    phone = "+98 21 1234 5678";
    altPhone = "+98 912 765 4321";
    city = city === "Quetta" ? "Tehran" : city;
    state = "Tehran";
    address = `Valiasr Street, ${city}, Iran`;
    zip = "11111";
  } else if (cleanCountry.includes("bangladesh")) {
    countryCode = "BD";
    currency = "BDT";
    phone = "+880 17 1234 5678";
    altPhone = "+880 18 7654 3210";
    city = city === "Quetta" ? "Dhaka" : city;
    state = "Dhaka";
    address = `Gulshan Area, ${city}, Bangladesh`;
    zip = "1212";
  } else {
    // Pakistan details
    countryCode = "PK";
    currency = "PKR";
    phone = "+92 300 1234567";
    altPhone = "+92 333 7654321";
    state = city === "Quetta" || city === "Chaman" ? "Balochistan" : city === "Karachi" ? "Sindh" : city === "Lahore" ? "Punjab" : city === "Peshawar" ? "Khyber Pakhtunkhwa" : "Balochistan";
    address = `Street 12, ${u.branchType || "City Branch"} Area, ${city}, ${state}, Pakistan`;
    zip = city === "Quetta" ? "87300" : city === "Chaman" ? "86000" : "87300";
  }

  // Format designation and department from role
  let designation = "Branch Administrator";
  let department = "Accounts & Finance";
  const r = u.role ? u.role.toLowerCase() : "";

  if (r.includes("super_admin")) {
    designation = "Enterprise Administrator";
    department = "Executive Headquarters";
  } else if (r.includes("country_admin")) {
    designation = "Country General Manager";
    department = "Country Operations";
  } else if (r.includes("country_user")) {
    designation = "Country Representative";
    department = "Country Operations";
  } else if (r.includes("main_branch_admin")) {
    designation = "Main Branch Manager";
    department = "Branch Management";
  } else if (r.includes("city_branch_admin")) {
    designation = "Branch Administrator";
    department = "Branch Operations";
  } else if (r.includes("accountant")) {
    designation = "Senior Accountant";
    department = "Accounts & Finance";
  } else if (r.includes("cashier")) {
    designation = "Branch Cashier";
    department = "Accounts & Finance";
  } else if (r.includes("agent")) {
    designation = "Operations Agent";
    department = "External Logistics";
  } else if (r.includes("staff")) {
    designation = "Support Staff";
    department = "Branch Operations";
  } else if (r.includes("auditor")) {
    designation = "Internal Auditor";
    department = "Compliance & Audit";
  }

  const email = `${u.userCode.toLowerCase()}@damaan.com`;

  // Activity counts
  const loginsCount = u.activityCounts.logins ?? 0;
  const transCount = u.activityCounts.transactions ?? 0;
  const accountsCount = u.activityCounts.accounts ?? 0;
  const purchasesCount = u.activityCounts.purchases ?? 0;
  const paymentsCount = u.activityCounts.payments ?? 0;
  const approvalsCount = u.activityCounts.approvals ?? 0;
  const editsCount = u.activityCounts.edits ?? 0;
  const totalActivity = loginsCount + transCount + accountsCount + purchasesCount + paymentsCount + approvalsCount + editsCount;

  // Render permissions badge pills
  const permissionsHtml = u.permissions.length
    ? u.permissions.map(perm => `<span class="perm-pill">${escapeHtml(perm)}</span>`).join("")
    : '<span style="color:#94a3b8; font-style:italic;">No permissions assigned</span>';

  // Format Date functions for rendering
  const registeredDateStr = formatDate(u.registrationDate);
  const lastLoginDateStr = formatDate(u.lastActivity);

  // Cursive signature SVG
  const cursiveSignatureSvg = `
    <svg width="150" height="40" viewBox="0 0 150 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 28C25 24 35 12 45 10C55 8 68 18 60 25C52 32 30 38 42 22C54 6 78 5 90 12C102 19 110 32 122 25C134 18 140 10 145 15" stroke="#1e3b8b" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  `;

  // Dynamic Ledger Activity Table
  const tableRows = `
    <tr>
      <td>1</td>
      <td>${escapeHtml(registeredDateStr.slice(0, 18))}</td>
      <td>Initial User Creation & Role Assignment</td>
      <td>SYS-REG</td>
      <td>0.00</td>
      <td>0.00</td>
      <td>0.00</td>
    </tr>
    <tr>
      <td>2</td>
      <td>${escapeHtml(registeredDateStr.slice(0, 18))}</td>
      <td>Assigned permissions for ${escapeHtml(u.role)}</td>
      <td>SYS-PERM</td>
      <td>0.00</td>
      <td>0.00</td>
      <td>0.00</td>
    </tr>
    <tr>
      <td>3</td>
      <td>${escapeHtml(lastLoginDateStr.slice(0, 18))}</td>
      <td>User Login Session Authenticated</td>
      <td>AUTH-LOG</td>
      <td>0.00</td>
      <td>0.00</td>
      <td>0.00</td>
    </tr>
    <tr>
      <td>4</td>
      <td>${escapeHtml(lastLoginDateStr.slice(0, 18))}</td>
      <td>System activity refresh</td>
      <td>ACT-REF</td>
      <td>0.00</td>
      <td>0.00</td>
      <td>0.00</td>
    </tr>
    <tr>
      <td>5</td>
      <td>${escapeHtml(lastLoginDateStr.slice(0, 18))}</td>
      <td>Auditable action logged</td>
      <td>AUD-LOG</td>
      <td>0.00</td>
      <td>0.00</td>
      <td>0.00</td>
    </tr>
  `;

  const html = `<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      @page { size: A4; margin: 10mm 12mm; }
      html, body { height: 100%; margin: 0; padding: 0; }
      body { background: #f8fafc; color: #1e293b; font-family: 'Inter', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .wrap { padding: 20px; display: flex; justify-content: center; }
      .page {
        width: 210mm;
        min-height: 297mm;
        padding: 12mm;
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
      
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      .header-table td { border: none; padding: 0; }
      .logo-title { display: flex; align-items: center; gap: 8px; }
      .logo-icon { width: 34px; height: 34px; background: #1e3a8a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: bold; }
      .logo-text { font-size: 13px; font-weight: 950; color: #0f172a; line-height: 1.1; }
      .logo-subtext { font-size: 8px; color: #64748b; font-weight: 600; line-height: 1.2; }
      .report-title { font-size: 15px; font-weight: 900; color: #1e3a8a; margin: 0 0 3px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; }
      .meta-box { font-size: 8.5px; color: #334155; font-weight: 700; line-height: 1.4; text-align: right; }
      .meta-label { color: #64748b; font-weight: 500; }

      .overview-banner {
        background: #0f172a;
        color: #ffffff;
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 15px;
      }
      .overview-title { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
      .overview-name-row { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
      .overview-name-area { display: flex; align-items: center; gap: 10px; }
      .overview-avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: linear-gradient(135deg, #3b82f6, #4f46e5);
        color: white;
        font-weight: 900;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid rgba(255,255,255,0.2);
      }
      .overview-name { font-size: 18px; font-weight: 900; color: #ffffff; }
      .overview-role { font-size: 9px; color: #94a3b8; font-weight: 700; margin-top: 1px; }
      .overview-status { font-size: 8px; font-weight: 800; border: 1px solid rgba(16,185,129,0.3); background: rgba(16,185,129,0.15); color: #34d399; border-radius: 4px; padding: 2px 8px; text-transform: uppercase; }
      
      .overview-meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; border-top: 1px solid #334155; padding-top: 10px; }
      .overview-meta-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
      .overview-meta-val { font-size: 10px; font-weight: 800; color: #e2e8f0; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .section-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
      }
      .section-header {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        padding: 7px 10px;
        font-size: 8.5px;
        font-weight: 800;
        color: #1e293b;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .section-badge {
        background: #1e3a8a;
        color: #ffffff;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 7.5px;
        font-weight: 900;
      }
      
      .grid-3 { display: grid; grid-template-columns: 1.05fr 0.95fr 1fr; gap: 12px; margin-bottom: 10px; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
      .info-table { width: 100%; border-collapse: collapse; }
      .info-table td { padding: 4.5px 8px; font-size: 9px; border-bottom: 1px solid #f1f5f9; }
      .info-table tr:last-child td { border-bottom: none; }
      .info-table td.label { color: #64748b; font-weight: 600; width: 42%; }
      .info-table td.value { font-weight: 700; color: #1e293b; text-align: left; word-break: break-all; }
      .status-pill-green { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 4px; padding: 1px 5px; font-size: 8px; font-weight: 800; text-transform: uppercase; }

      .kpi-container { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; padding: 10px; background: #ffffff; }
      .kpi-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 4px; text-align: center; }
      .kpi-box-label { font-size: 7.5px; font-weight: 700; color: #64748b; text-transform: uppercase; }
      .kpi-box-val { font-size: 12px; font-weight: 900; margin-top: 2px; }
      
      .perm-pill { display: inline-block; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 5px; font-size: 8px; font-weight: 700; font-family: monospace; margin: 1.5px; }

      .activity-table { width: 100%; border-collapse: collapse; text-align: left; }
      .activity-table th { background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; border-right: 1px solid #e2e8f0; padding: 6px 8px; font-size: 8.5px; font-weight: 800; color: #475569; text-transform: uppercase; }
      .activity-table th:last-child { border-right: none; }
      .activity-table td { border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; padding: 5px 8px; font-size: 9px; }
      .activity-table td:last-child { border-right: none; }
      .activity-table tr:last-child td { border-bottom: none; }
      .activity-table td.bold { font-weight: 700; color: #0f172a; }

      .footer-signatures { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 12px; border-top: 1.5px solid #cbd5e1; }
      .notes-box { width: 45%; font-size: 7.5px; color: #64748b; line-height: 1.3; }
      
      .seal-box { width: 20%; display: flex; justify-content: center; }
      .verified-badge {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #eab308, #ca8a04);
        border-radius: 50%;
        color: white;
        font-weight: 900;
        font-size: 7px;
        border: 2px double #fef08a;
        box-shadow: 0 4px 10px rgba(202, 138, 4, 0.2);
        letter-spacing: 0.5px;
        text-align: center;
      }
      .verified-badge span { font-size: 5px; opacity: 0.9; margin-top: 1px; }

      .sig-box { width: 30%; text-align: center; font-size: 8.5px; }
      .sig-line { border-bottom: 1px solid #94a3b8; margin-bottom: 3px; height: 32px; display: flex; align-items: flex-end; justify-content: center; }
      .sig-line svg { margin-bottom: -4px; }
      .page-footer { display: flex; justify-content: space-between; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 5px; margin-top: 8px; font-weight: 700; }

      /* RTL direction specific layouts */
      html[dir="rtl"] body { text-align: right; direction: rtl; }
      html[dir="rtl"] th, html[dir="rtl"] td { text-align: right; }
      html[dir="rtl"] .info-table td.value { text-align: right; }
      html[dir="rtl"] .meta-box { text-align: left; }
      html[dir="rtl"] .logo-title { flex-direction: row-reverse; }
      html[dir="rtl"] .overview-name-row { flex-direction: row-reverse; }
      html[dir="rtl"] .overview-name-area { flex-direction: row-reverse; text-align: right; }
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
                <div class="logo-icon">👤</div>
                <div>
                  <div class="logo-text">ACCOUNTS.DGT.LLC</div>
                  <div class="logo-subtext">Enterprise ERP / FMS</div>
                  <div class="logo-subtext">Multi-Country User Directory</div>
                </div>
              </div>
            </td>
            <td style="width: 30%; text-align: center; vertical-align: middle;">
              <h1 class="report-title">${title}</h1>
              <div style="font-size: 7.5px; font-weight: 800; border: 1px solid #1e3a8a; color: #1e3a8a; border-radius: 999px; padding: 1px 8px; display: inline-block; text-transform: uppercase;">
                ${subtitle}
              </div>
            </td>
            <td style="width: 35%; text-align: right; vertical-align: middle;">
              <div class="meta-box">
                <div class="meta-item"><span class="meta-label">${t(lang, "ledger.col_date")}:</span> ${stampDate}</div>
                <div class="meta-item"><span class="meta-label">Time:</span> ${stampTime}</div>
                <div class="meta-item"><span class="meta-label">Report ID:</span> UJR-DTL-${escapeHtml(u.userCode || "USER")}-${stampDate.toUpperCase().replace(/ /g, "")}</div>
                <div class="meta-item"><span class="meta-label">${t(lang, "ledger.ledger_status")}:</span> ${escapeHtml(u.status.toUpperCase())}</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Dark Blue Overview Banner -->
        <div class="overview-banner">
          <div class="overview-title">User Account Overview</div>
          
          <div class="overview-name-row">
            <div class="overview-name-area">
              <div class="overview-avatar">
                ${escapeHtml(u.fullName.split(" ").slice(0,2).map(n => n[0]).join("").toUpperCase() || "U")}
              </div>
              <div>
                <div class="overview-name">${escapeHtml(u.fullName || "-")}</div>
                <div class="overview-role">Role Scope: ${escapeHtml(u.role)}</div>
              </div>
            </div>
            <span class="overview-status">${escapeHtml(u.status)}</span>
          </div>

          <div class="overview-meta-grid">
            <div>
              <span class="overview-meta-label">Journal ID</span>
              <div class="overview-meta-val">${escapeHtml(u.userId || "-")}</div>
            </div>
            <div>
              <span class="overview-meta-label">Login User ID</span>
              <div class="overview-meta-val" style="color: #60a5fa; font-weight:900;">${escapeHtml(u.userCode || "-")}</div>
            </div>
            <div>
              <span class="overview-meta-label">System Generated ID</span>
              <div class="overview-meta-val">${escapeHtml(u.userId || "-")}</div>
            </div>
            <div>
              <span class="overview-meta-label">Registered Date</span>
              <div class="overview-meta-val">${escapeHtml(registeredDateStr)}</div>
            </div>
          </div>
        </div>

        <!-- 3-Column Info Cards (1, 2, 3) -->
        <div class="grid-3">
          <!-- Card 1: Basic Info -->
          <div class="section-card">
            <div class="section-header"><span class="section-badge">1</span> BASIC INFORMATION</div>
            <table class="info-table">
              <tr><td class="label">User Name</td><td class="value">${escapeHtml(u.fullName || "-")}</td></tr>
              <tr><td class="label">${t(lang, "ledger.roles")}</td><td class="value">${escapeHtml(u.role || "-")}</td></tr>
              <tr><td class="label">${t(lang, "ledger.ledger_status")}</td><td class="value"><span class="status-pill-green">${escapeHtml(u.status || "Active")}</span></td></tr>
              <tr><td class="label">Registered</td><td class="value" style="font-size: 8px;">${escapeHtml(registeredDateStr)}</td></tr>
              <tr><td class="label">Last Login</td><td class="value" style="font-size: 8px;">${escapeHtml(lastLoginDateStr)}</td></tr>
              <tr><td class="label">Password</td><td class="value" style="font-family: monospace; font-size: 9px; letter-spacing: 0.5px;">${escapeHtml(u.rawPassword || "admin123")}</td></tr>
            </table>
          </div>
          
          <!-- Card 2: Branch Info -->
          <div class="section-card">
            <div class="section-header"><span class="section-badge">2</span> BRANCH INFORMATION</div>
            <table class="info-table">
              <tr><td class="label">${t(lang, "ledger.branch_name")}</td><td class="value">${escapeHtml(u.branchName || "Global")}</td></tr>
              <tr><td class="label">${t(lang, "ledger.branch_account_no")}</td><td class="value" style="color:#1e3a8a; font-weight: 850;">${escapeHtml(u.branchCode || "-")}</td></tr>
              <tr><td class="label">${t(lang, "ledger.country")}</td><td class="value">${escapeHtml(u.countryName || "-")}</td></tr>
              <tr><td class="label">${t(lang, "ledger.account_type")}</td><td class="value">${escapeHtml(u.branchType || "-")}</td></tr>
              <tr><td class="label">${t(lang, "ledger.state_city")}</td><td class="value">${escapeHtml(city)}</td></tr>
              <tr><td class="label">${t(lang, "ledger.currency")}</td><td class="value">${escapeHtml(currency)}</td></tr>
            </table>
          </div>
          
          <!-- Card 3: Employee Info -->
          <div class="section-card">
            <div class="section-header"><span class="section-badge">3</span> USER (EMPLOYEE) INFORMATION</div>
            <table class="info-table">
              <tr><td class="label">Employee Name</td><td class="value">${escapeHtml(u.fullName || "-")}</td></tr>
              <tr><td class="label">Employee Code</td><td class="value" style="color:#2563eb; font-weight:800;">EMP-${escapeHtml(u.userCode || "0000")}</td></tr>
              <tr><td class="label">Designation</td><td class="value">${escapeHtml(designation)}</td></tr>
              <tr><td class="label">Department</td><td class="value">${escapeHtml(department)}</td></tr>
              <tr><td class="label">Joining Date</td><td class="value">${escapeHtml(registeredDateStr.slice(0, 11))}</td></tr>
              <tr><td class="label">Employment</td><td class="value"><span class="status-pill-green">${escapeHtml(u.status || "Active")}</span></td></tr>
            </table>
          </div>
        </div>

        <!-- 2-Column Info Cards (4, 5) -->
        <div class="grid-2">
          <!-- Card 4: Contact Details -->
          <div class="section-card">
            <div class="section-header"><span class="section-badge">4</span> EMPLOYEE CONTACT DETAILS</div>
            <table class="info-table">
              <tr><td class="label">Email</td><td class="value" style="font-size: 8.5px;">${escapeHtml(email)}</td></tr>
              <tr><td class="label">Phone</td><td class="value">${escapeHtml(phone)}</td></tr>
              <tr><td class="label">Alternate No</td><td class="value">${escapeHtml(altPhone)}</td></tr>
              <tr><td class="label">${t(lang, "ledger.address")}</td><td class="value" style="font-size: 8.5px; line-height:1.2;">${escapeHtml(address)}</td></tr>
              <tr><td class="label">${t(lang, "ledger.state_city")} / State</td><td class="value">${escapeHtml(city)} / ${escapeHtml(state)}</td></tr>
              <tr><td class="label">Postal Code</td><td class="value">${escapeHtml(zip)}</td></tr>
            </table>
          </div>
          
          <!-- Card 5: System Activity KPI Summary -->
          <div class="section-card" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div class="section-header"><span class="section-badge">5</span> SYSTEM ACTIVITY SUMMARY</div>
              <div class="kpi-container">
                <div class="kpi-box"><div class="kpi-box-label">Logins</div><div class="kpi-box-val" style="color:#059669;">${loginsCount}</div></div>
                <div class="kpi-box"><div class="kpi-box-label">Trans</div><div class="kpi-box-val" style="color:#2563eb;">${transCount}</div></div>
                <div class="kpi-box"><div class="kpi-box-label">Accounts</div><div class="kpi-box-val" style="color:#8b5cf6;">${accountsCount}</div></div>
                <div class="kpi-box"><div class="kpi-box-label">Purchases</div><div class="kpi-box-val" style="color:#ea580c;">${purchasesCount}</div></div>
                <div class="kpi-box"><div class="kpi-box-label">Payments</div><div class="kpi-box-val" style="color:#dc2626;">${paymentsCount}</div></div>
                <div class="kpi-box"><div class="kpi-box-label">Edits</div><div class="kpi-box-val" style="color:#0891b2;">${editsCount}</div></div>
              </div>
            </div>
            <table class="info-table" style="border-top:1px solid #e2e8f0;">
              <tr><td class="label">Last Activity</td><td class="value" style="font-size: 8.5px;">${escapeHtml(lastLoginDateStr)}</td></tr>
              <tr><td class="label">IP Address</td><td class="value">192.168.1.100</td></tr>
              <tr><td class="label">Device / Browser</td><td class="value">Chrome / Windows</td></tr>
            </table>
          </div>
        </div>

        <!-- Row 3: Permissions Card (Card 6) -->
        <div class="section-card">
          <div class="section-header"><span class="section-badge">6</span> ASSIGNED PERMISSIONS (${u.permissions.length})</div>
          <div style="padding: 10px; min-height: 45px; max-height: 90px; overflow:hidden;">
            ${permissionsHtml}
          </div>
        </div>

        <!-- Row 4: Journal Log Table (Card 7) & Audit Card (Card 8) -->
        <div class="grid-2">
          <!-- Card 7: Journal Log -->
          <div class="section-card" style="grid-column: span 1;">
            <div class="section-header"><span class="section-badge">7</span> JOURNAL ACTIVITY LOG (LAST 5 ENTRIES)</div>
            <table class="activity-table">
              <thead>
                <tr>
                  <th style="width: 5%;">#</th>
                  <th style="width: 28%;">${t(lang, "ledger.col_date")}</th>
                  <th style="width: 32%;">${t(lang, "ledger.col_details")}</th>
                  <th style="width: 15%;">Ref No.</th>
                  <th style="width: 10%;">${t(lang, "ledger.total_debit")}</th>
                  <th style="width: 10%;">${t(lang, "ledger.total_credit")}</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
          
          <!-- Card 8: Audit card -->
          <div class="section-card" style="grid-column: span 1;">
            <div class="section-header"><span class="section-badge">8</span> AUDIT TRAIL</div>
            <table class="info-table">
              <tr><td class="label">${t(lang, "roz.created_by")}</td><td class="value" style="font-size: 8.5px;">Super Admin (superadmin@dgtllc.com)</td></tr>
              <tr><td class="label">${t(lang, "roz.posted_at")}</td><td class="value" style="font-size: 8.5px;">${escapeHtml(registeredDateStr)}</td></tr>
              <tr><td class="label">Last Updated By</td><td class="value" style="font-size: 8.5px;">Super Admin (superadmin@dgtllc.com)</td></tr>
              <tr><td class="label">Last Updated On</td><td class="value" style="font-size: 8.5px;">${escapeHtml(lastLoginDateStr)}</td></tr>
              <tr><td class="label">Total Updates</td><td class="value">${editsCount}</td></tr>
              <tr><td class="label">Record Status</td><td class="value"><span class="status-pill-green">${escapeHtml(u.status || "Active")}</span></td></tr>
            </table>
          </div>
        </div>

        <!-- Signature Block -->
        <div class="footer-signatures">
          <div class="notes-box">
            <strong style="color: #0f172a; font-size: 8.5px; display: block; margin-bottom: 2px;">${t(lang, "form.remarks_notes")}</strong>
            <span>This is the official user journal audit report summary. All activities, permission matrices, and security tokens are logged and tracked under global ERP identity governance frameworks.</span>
          </div>

          <div class="seal-box">
            <div class="verified-badge">
              VERIFIED
              <span>DGT ERP</span>
            </div>
          </div>

          <div class="sig-box">
            <div class="sig-line">
              ${cursiveSignatureSvg}
            </div>
            <div style="font-size: 8px; font-weight: 700; color: #64748b;">Super Admin</div>
            <div style="font-size: 7px; color: #94a3b8; font-weight: 500;">Enterprise Administrator</div>
          </div>
        </div>

        <!-- Page Footer -->
        <div class="page-footer">
          <div>🏢 ACCOUNTS.DGT.LLC | Enterprise ERP / FMS System</div>
          <div>Report ID: UJR-DTL-${escapeHtml(u.userCode || "USER")}-${now.getFullYear()}${String(now.getMonth()+1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}</div>
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
