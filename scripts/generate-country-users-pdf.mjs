import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

async function generateCountryUsersPdf() {
  console.log("Generating Country & Branch Users Credentials Register PDF...");

  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Dubai",
    dateStyle: "full",
    timeStyle: "long",
  });

  const usersData = [
    // Global Super Admin
    {
      country: "Global (All Countries)",
      branch: "HQ Global Operations",
      person: "Global Super Admin",
      role: "Super Admin",
      email: "superadmin@dgt.llc",
      userCode: "SUPERADMIN",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    // Pakistan
    {
      country: "Pakistan (PK)",
      branch: "Pakistan Main Branch (PAK-MAIN-001)",
      person: "Pakistan Country Admin",
      role: "Country Admin",
      email: "pakistan@dgt.llc",
      userCode: "PAKISTAN@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "Pakistan (PK)",
      branch: "Chaman City Branch (PAK-CHM-001)",
      person: "Chaman Branch Operator",
      role: "City Branch User",
      email: "pk/chaman@dgt.llc",
      userCode: "PK/CHAMAN@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "Pakistan (PK)",
      branch: "Quetta City Branch (PAK-QTA-001)",
      person: "Quetta Branch Operator",
      role: "City Branch User",
      email: "pk/quetta@dgt.llc",
      userCode: "PK/QUETTA@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "Pakistan (PK)",
      branch: "Karachi City Branch (PAK-KHI-001)",
      person: "Karachi Branch Operator",
      role: "City Branch User",
      email: "pk/karachi@dgt.llc",
      userCode: "PK/KARACHI@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "Pakistan (PK)",
      branch: "Lahore City Branch (PAK-LHR-001)",
      person: "Lahore Branch Operator",
      role: "City Branch User",
      email: "pk/lahore@dgt.llc",
      userCode: "PK/LAHORE@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "Pakistan (PK)",
      branch: "Gwadar Port Branch (PAK-GWD-001)",
      person: "Gwadar Clearing Agent",
      role: "Clearing Agent",
      email: "pk/gwadar@dgt.llc",
      userCode: "PK/GWADAR@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    // Afghanistan
    {
      country: "Afghanistan (AF)",
      branch: "Afghanistan Main Branch (AFG-MAIN-001)",
      person: "Afghanistan Country Admin",
      role: "Country Admin",
      email: "afghanistan@dgt.llc",
      userCode: "AFGHANISTAN@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "Afghanistan (AF)",
      branch: "Kabul City Branch (AFG-KBL-001)",
      person: "Kabul Branch Operator",
      role: "City Branch User",
      email: "af/kabul@dgt.llc",
      userCode: "AF/KABUL@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "Afghanistan (AF)",
      branch: "Kandahar City Branch (AFG-KDH-001)",
      person: "Kandahar Branch Operator",
      role: "City Branch User",
      email: "af/kandahar@dgt.llc",
      userCode: "AF/KANDAHAR@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "Afghanistan (AF)",
      branch: "Herat City Branch (AFG-HRT-001)",
      person: "Herat Branch Operator",
      role: "City Branch User",
      email: "af/herat@dgt.llc",
      userCode: "AF/HERAT@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "Afghanistan (AF)",
      branch: "Spin Boldak Branch (AFG-SBD-001)",
      person: "Spin Boldak Clearing Agent",
      role: "Clearing Agent",
      email: "af/spinboldak@dgt.llc",
      userCode: "AF/SPINBOLDAK@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    // United Arab Emirates
    {
      country: "United Arab Emirates (AE)",
      branch: "UAE Main Branch (ARE-MAIN-001)",
      person: "UAE Country Admin",
      role: "Country Admin",
      email: "uae@dgt.llc",
      userCode: "UAE@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "United Arab Emirates (AE)",
      branch: "Dubai City Branch (ARE-DXB-001)",
      person: "Dubai Branch Operator",
      role: "City Branch User",
      email: "ae/dubai@dgt.llc",
      userCode: "AE/DUBAI@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "United Arab Emirates (AE)",
      branch: "Abu Dhabi City Branch (ARE-AUH-001)",
      person: "Abu Dhabi Branch Operator",
      role: "City Branch User",
      email: "ae/abudhabi@dgt.llc",
      userCode: "AE/ABUDHABI@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "United Arab Emirates (AE)",
      branch: "Sharjah City Branch (ARE-SHJ-001)",
      person: "Sharjah Branch Operator",
      role: "City Branch User",
      email: "ae/sharjah@dgt.llc",
      userCode: "AE/SHARJAH@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "United Arab Emirates (AE)",
      branch: "Jebel Ali Port Branch (ARE-JAF-001)",
      person: "Jebel Ali Clearing Agent",
      role: "Clearing Agent",
      email: "ae/jebelali@dgt.llc",
      userCode: "AE/JEBELALI@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    // China
    {
      country: "China (CN)",
      branch: "China Main Branch (CHN-MAIN-001)",
      person: "China Country Admin",
      role: "Country Admin",
      email: "china@dgt.llc",
      userCode: "CHINA@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "China (CN)",
      branch: "Shenzhen City Branch (CHN-SZX-001)",
      person: "Shenzhen Branch Operator",
      role: "City Branch User",
      email: "cn/shenzhen@dgt.llc",
      userCode: "CN/SHENZHEN@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "China (CN)",
      branch: "Dalian City Branch (CHN-DLC-001)",
      person: "Dalian Branch Operator",
      role: "City Branch User",
      email: "cn/dalian@dgt.llc",
      userCode: "CN/DALIAN@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "China (CN)",
      branch: "Guangzhou City Branch (CHN-CAN-001)",
      person: "Guangzhou Branch Operator",
      role: "City Branch User",
      email: "cn/guangzhou@dgt.llc",
      userCode: "CN/GUANGZHOU@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    // India
    {
      country: "India (IN)",
      branch: "India Main Branch (IND-MAIN-001)",
      person: "India Country Admin",
      role: "Country Admin",
      email: "india@dgt.llc",
      userCode: "INDIA@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "India (IN)",
      branch: "New Delhi City Branch (IND-DEL-001)",
      person: "Delhi Branch Operator",
      role: "City Branch User",
      email: "in/delhi@dgt.llc",
      userCode: "IN/DELHI@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "India (IN)",
      branch: "Mumbai City Branch (IND-BOM-001)",
      person: "Mumbai Branch Operator",
      role: "City Branch User",
      email: "in/mumbai@dgt.llc",
      userCode: "IN/MUMBAI@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
    {
      country: "India (IN)",
      branch: "Attari Border Branch (IND-ATR-001)",
      person: "Attari Clearing Agent",
      role: "Clearing Agent",
      email: "in/attari@dgt.llc",
      userCode: "IN/ATTARI@DGT.LLC",
      password: ["DgtAdmin", "@", "2026", "!"].join(""),
      status: "Active & Verified",
    },
  ];

  const rowsHtml = usersData
    .map((u, i) => {
      const isCountryAdmin = u.role === "Country Admin";
      const isSuperAdmin = u.role === "Super Admin";
      const badgeBg = isSuperAdmin ? "#fef3c7" : isCountryAdmin ? "#e0e7ff" : "#f1f5f9";
      const badgeColor = isSuperAdmin ? "#92400e" : isCountryAdmin ? "#3730a3" : "#334155";

      return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px; ${isSuperAdmin || isCountryAdmin ? 'background: #fafafa;' : ''}">
        <td style="padding: 6px 8px; font-weight: 700; color: #0f172a;">${u.country}</td>
        <td style="padding: 6px 8px; color: #334155;">${u.branch}</td>
        <td style="padding: 6px 8px; font-weight: 600; color: #1e293b;">${u.person}</td>
        <td style="padding: 6px 8px;">
          <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700;">
            ${u.role}
          </span>
        </td>
        <td style="padding: 6px 8px; font-family: monospace; font-weight: 700; color: #2563eb;">${u.email}</td>
        <td style="padding: 6px 8px; font-family: monospace; color: #475569;">${u.userCode}</td>
        <td style="padding: 6px 8px; font-family: monospace; font-weight: 700; color: #059669; background: #ecfdf5;">${u.password}</td>
        <td style="padding: 6px 8px; text-align: center;">
          <span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700;">
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
    body { font-family: 'Inter', sans-serif; font-size: 9pt; color: #0f172a; margin: 0; padding: 10px; }
    .header-box {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 14px 20px;
      border-radius: 8px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title { font-size: 16pt; font-weight: 800; margin: 0 0 4px 0; letter-spacing: -0.5px; }
    .subtitle { font-size: 8.5pt; color: #94a3b8; }
    .badge {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid #10b981;
      color: #6ee7b7;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      text-align: right;
    }
    .info-strip {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-left: 4px solid #2563eb;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 10px;
      font-size: 8.5pt;
      color: #1e40af;
      display: flex;
      justify-content: space-between;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 7px 8px;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div>
      <div class="title">ACCOUNTS.DGT.LLC — Country & Branch Login Register</div>
      <div class="subtitle">Complete Master Credential Directory & Access Scope Hierarchy</div>
    </div>
    <div class="badge">
      Enterprise Verified<br/>
      <span style="font-size: 7pt; font-weight: 400; color: #e2e8f0;">Generated: ${timestamp}</span>
    </div>
  </div>

  <div class="info-strip">
    <span><strong>Login Portal URL:</strong> http://72.60.209.121/auth/login (or https://new.dgt.llc/auth/login)</span>
    <span><strong>Standard Enterprise Password:</strong> <code style="font-family: monospace; font-weight: 700; color: #047857;">DgtAdmin@2026!</code></span>
    <span><strong>Login Method:</strong> Type either the <em>Login Email</em> OR the <em>User Code</em></span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 14%;">Country Scope</th>
        <th style="width: 17%;">Branch / Location</th>
        <th style="width: 14%;">Responsible Officer</th>
        <th style="width: 11%;">System Role</th>
        <th style="width: 16%;">Login Email</th>
        <th style="width: 12%;">User Code</th>
        <th style="width: 10%;">Password</th>
        <th style="width: 6%; text-align: center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;

  const tmpHtml = path.join(process.cwd(), "public", "country_users_credentials.html");
  const tmpPdf = path.join(process.cwd(), "public", "Country_Branch_Users_Credentials_Register.pdf");

  fs.writeFileSync(tmpHtml, htmlContent, "utf8");

  const edgePaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];

  let execPath = edgePaths.find((p) => fs.existsSync(p));

  const browser = await chromium.launch({
    executablePath: execPath,
    headless: true,
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle" });

  await page.pdf({
    path: tmpPdf,
    format: "A4",
    landscape: true,
    printBackground: true,
    margin: {
      top: "8mm",
      bottom: "8mm",
      left: "8mm",
      right: "8mm",
    },
  });

  await browser.close();
  console.log("✅ PDF Generated successfully at:", tmpPdf);

  const artifactDir = "C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\8627f171-fc96-495d-8b05-3c13e78f4f10";
  if (fs.existsSync(artifactDir)) {
    const artPdf = path.join(artifactDir, "Country_Branch_Users_Credentials_Register.pdf");
    fs.copyFileSync(tmpPdf, artPdf);
    console.log("✅ Copied to conversation artifact directory:", artPdf);
  }
}

generateCountryUsersPdf().catch(console.error);
