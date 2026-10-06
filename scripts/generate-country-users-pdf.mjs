// Generates a TEST-DB-only credentials reference sheet for local onboarding.
// The PDF is written to a local, git-ignored output directory ONLY — it must
// never be written into `public/`, since anything there is served publicly,
// unauthenticated, by the deployed app. (A prior version of this script did
// write into public/, and the resulting PDF — with a shared plaintext
// password baked in — was reachable by anyone with the URL; that file has
// been deleted and the password rotated. See docs/security-incidents.md.)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(p) { if (!fs.existsSync(p)) return {}; return Object.fromEntries(fs.readFileSync(p, "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })); }
const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local"), ...process.env };

const TEST_PROJECT_REF = "csesvyxxjivnkkozgopt";
if (!env.DATABASE_URL || !env.DATABASE_URL.includes(TEST_PROJECT_REF)) {
  console.error(`Refusing to run: DATABASE_URL does not point at the test project (${TEST_PROJECT_REF}).`);
  process.exit(1);
}

const TEST_PASSWORD = env.DGT_TEST_PASSWORD;
const DEMO_USERS_PASSWORD = env.DGT_DEMO_USERS_PASSWORD;
if (!TEST_PASSWORD || !DEMO_USERS_PASSWORD) {
  console.error("Set DGT_TEST_PASSWORD and DGT_DEMO_USERS_PASSWORD in your local .env (see scripts/rotate-debug-test-password.mjs).");
  process.exit(1);
}

async function generateCountryUsersPdf() {
  console.log("Generating Country & Branch Users Credentials Register PDF (local reference only)...");

  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Dubai",
    dateStyle: "full",
    timeStyle: "long",
  });

  const usersData = [
    // 3 Global Super Admins
    {
      country: "Global (All Operations)",
      branch: "Head Office / Super Admin",
      person: "Principal Super Admin",
      role: "Super Admin",
      email: "superadmin@dgt.llc",
      userCode: "SUPERADMIN",
      password: TEST_PASSWORD,
      status: "Active & Verified",
    },
    {
      country: "Global (All Operations)",
      branch: "Head Office / Operations Oversight",
      person: "Global Group Executive",
      role: "Super Admin",
      email: "all.superadmin@dgt.llc",
      userCode: "ALL.SUPERADMIN",
      password: DEMO_USERS_PASSWORD,
      status: "Active & Verified",
    },
    {
      country: "Global (All Operations)",
      branch: "Head Office / Compliance & Audit",
      person: "Chief Audit Officer",
      role: "Super Admin",
      email: "audit.superadmin@dgt.llc",
      userCode: "AUDIT.SUPERADMIN",
      password: DEMO_USERS_PASSWORD,
      status: "Active & Verified",
    },
    // 2 Country Admins
    {
      country: "Pakistan (PK)",
      branch: "Pakistan Main Branch (PAK-MAIN-001)",
      person: "Pakistan Country Director",
      role: "Country Admin",
      email: "pakistan.admin@dgt.llc",
      userCode: "PAKISTAN.ADMIN",
      password: DEMO_USERS_PASSWORD,
      status: "Active & Verified",
    },
    {
      country: "United Arab Emirates (AE)",
      branch: "UAE Main Branch (ARE-MAIN-001)",
      person: "UAE Country Director",
      role: "Country Admin",
      email: "uae.admin@dgt.llc",
      userCode: "UAE.ADMIN",
      password: DEMO_USERS_PASSWORD,
      status: "Active & Verified",
    },
    // 3 City Admins
    {
      country: "Pakistan (PK)",
      branch: "Quetta City Branch (PAK-QUE-001)",
      person: "Quetta Branch Administrator",
      role: "City Branch Admin",
      email: "quetta.branch@dgt.llc",
      userCode: "QUETTA.ADMIN",
      password: DEMO_USERS_PASSWORD,
      status: "Active & Verified",
    },
    {
      country: "Pakistan (PK)",
      branch: "Chaman City Branch (PAK-CHM-001)",
      person: "Chaman Branch Administrator",
      role: "City Branch Admin",
      email: "chaman.branch@dgt.llc",
      userCode: "CHAMAN.ADMIN",
      password: DEMO_USERS_PASSWORD,
      status: "Active & Verified",
    },
    {
      country: "United Arab Emirates (AE)",
      branch: "Deira Dubai City Branch (UAE-DEI-001)",
      person: "Deira Dubai Branch Administrator",
      role: "City Branch Admin",
      email: "dubai.branch@dgt.llc",
      userCode: "DUBAI.ADMIN",
      password: DEMO_USERS_PASSWORD,
      status: "Active & Verified",
    }
  ];

  const rowsHtml = usersData
    .map((u, i) => {
      const isCountryAdmin = u.role === "Country Admin";
      const isSuperAdmin = u.role === "Super Admin";
      const badgeBg = isSuperAdmin ? "#fef3c7" : isCountryAdmin ? "#e0e7ff" : "#f0fdf4";
      const badgeColor = isSuperAdmin ? "#92400e" : isCountryAdmin ? "#3730a3" : "#166534";

      return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px; ${isSuperAdmin ? 'background: #f8fafc;' : isCountryAdmin ? 'background: #fdfefe;' : ''}">
        <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">${u.country}</td>
        <td style="padding: 10px 12px; color: #334155; font-weight: 600;">${u.branch}</td>
        <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">${u.person}</td>
        <td style="padding: 10px 12px;">
          <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">
            ${u.role}
          </span>
        </td>
        <td style="padding: 10px 12px; font-family: monospace; font-weight: 700; color: #2563eb; font-size: 12px;">${u.email}</td>
        <td style="padding: 10px 12px; font-family: monospace; font-weight: 700; color: #475569;">${u.userCode}</td>
        <td style="padding: 10px 12px; font-family: monospace; font-weight: 700; color: #059669; background: #ecfdf5; font-size: 12px;">${u.password}</td>
        <td style="padding: 10px 12px; text-align: center;">
          <span style="background: #dcfce7; color: #15803d; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700;">
            ✓ ${u.status}
          </span>
        </td>
      </tr>`;
    })
    .join("");

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Country & Branch Users Login Credentials Register</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    @page {
      size: A4 landscape;
      margin: 10mm 8mm 10mm 8mm;
      @bottom-right {
        content: "Page " counter(page);
        font-size: 8pt;
        font-family: 'Inter', sans-serif;
        color: #64748b;
      }
      @bottom-left {
        content: "CONFIDENTIAL & OFFICIAL — DGT LLC Accounts ERP Country & Branch Access Register";
        font-size: 8pt;
        font-family: 'Inter', sans-serif;
        color: #dc2626;
        font-weight: 600;
      }
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Inter', sans-serif; font-size: 10pt; color: #0f172a; margin: 0; padding: 14px; background: #ffffff; }
    .header-box {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 18px 24px;
      border-radius: 10px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .title { font-size: 18pt; font-weight: 800; margin: 0 0 4px 0; letter-spacing: -0.5px; }
    .subtitle { font-size: 9.5pt; color: #94a3b8; font-weight: 500; }
    .badge {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid #10b981;
      color: #6ee7b7;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      text-align: right;
    }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 14px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .kpi-label { font-size: 8.5pt; text-transform: uppercase; font-weight: 700; color: #64748b; }
    .kpi-val { font-size: 16pt; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .kpi-sub { font-size: 8pt; color: #94a3b8; font-weight: 500; }
    .info-strip {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-left: 4px solid #2563eb;
      padding: 10px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 9pt;
      color: #1e40af;
      display: flex;
      justify-content: space-between;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05); }
    th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 10px 12px;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .footer-notes {
      margin-top: 20px;
      padding: 12px 16px;
      background: #fefce8;
      border: 1px solid #fef08a;
      border-radius: 8px;
      font-size: 8.5pt;
      color: #854d0e;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <div class="title">ACCOUNTS.DGT.LLC — Verified Credentials Register</div>
      <div class="subtitle">Official 2-Country (Pakistan & UAE), 3-Branch Business Hierarchy & Login Directory</div>
    </div>
    <div class="badge">
      Production Verified<br/>
      <span style="font-size: 7.5pt; font-weight: 400; color: #e2e8f0;">Generated: ${timestamp}</span>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-label">Active Countries</div>
      <div class="kpi-val" style="color: #2563eb;">2</div>
      <div class="kpi-sub">Pakistan (PK) & UAE (AE)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Country Main Branches</div>
      <div class="kpi-val" style="color: #7c3aed;">2</div>
      <div class="kpi-sub">PAK-MAIN-001 & ARE-MAIN-001</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Active City Branches</div>
      <div class="kpi-val" style="color: #059669;">3</div>
      <div class="kpi-sub">Quetta, Chaman, Deira Dubai</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Authorized Users</div>
      <div class="kpi-val" style="color: #0f172a;">8</div>
      <div class="kpi-sub">3 Global, 2 Country, 3 City</div>
    </div>
  </div>

  <div class="info-strip">
    <span><strong>Login Portal URL:</strong> http://72.60.209.121/auth/login &nbsp;|&nbsp; https://new.dgt.llc/auth/login</span>
    <span><strong>Password:</strong> see the Password column per row — each row's password is per-user, not shared</span>
    <span><strong>Login Method:</strong> Use either the <em>Login Email</em> OR the <em>User Code</em></span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Country Scope</th>
        <th style="width: 20%;">Branch / Location</th>
        <th style="width: 15%;">Responsible Officer</th>
        <th style="width: 12%;">System Role</th>
        <th style="width: 15%;">Login Email</th>
        <th style="width: 11%;">User Code</th>
        <th style="width: 12%;">Password</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer-notes">
    <strong>Security Notice:</strong> This document contains TEST/DEV-environment credentials for Digital Dock Accounts ERP (project ${TEST_PROJECT_REF} — never production). Do not share outside authorized development personnel, and never commit or publicly host this file.
  </div>
</body>
</html>`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.setContent(htmlContent, { waitUntil: "networkidle" });

  // git-ignored local-only output directory — never `public/` (see header note).
  const outputDir = path.resolve("local-output");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPdfPath = path.join(outputDir, "Country_Branch_Users_Credentials_Register.pdf");

  await page.pdf({
    path: outputPdfPath,
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: {
      top: "10mm",
      right: "8mm",
      bottom: "10mm",
      left: "8mm",
    },
  });

  await browser.close();

  const stats = fs.statSync(outputPdfPath);
  console.log(`\n✅ PDF generated successfully (local only, not deployed): ${outputPdfPath}`);
  console.log(`✅ File size: ${(stats.size / 1024).toFixed(1)} KB`);
}

generateCountryUsersPdf().catch(console.error);
