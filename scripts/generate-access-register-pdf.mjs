import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { COUNTRY_BRANCH_ACCESS_REGISTER } from '../lib/repositories/access-register-repository.ts';

async function generateAccessRegisterPdf() {
  console.log("Generating Country / Branch Login Access Register PDF...");

  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Dubai',
    dateStyle: 'full',
    timeStyle: 'long'
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Country / Branch Login Access Register</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @page {
      size: A4 landscape;
      margin: 12mm 10mm 12mm 10mm;
      @bottom-right {
        content: "Page " counter(page);
        font-size: 8pt;
        font-family: 'Inter', sans-serif;
        color: #64748b;
      }
      @bottom-left {
        content: "CONFIDENTIAL & RESTRICTED — Super Admin Credential & Access Register — ACCOUNTS.DGT.LLC";
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
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #334155;
    }

    .title {
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0 0 4px 0;
    }

    .subtitle {
      font-size: 8.5pt;
      color: #94a3b8;
    }

    .security-badge {
      background: rgba(220, 38, 38, 0.2);
      border: 1px solid #ef4444;
      color: #fca5a5;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      text-align: right;
    }

    .info-bar {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-left: 4px solid #dc2626;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 12px;
      font-size: 7.5pt;
      color: #991b1b;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
    }

    th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      text-align: left;
      padding: 6px 6px;
      border: 1px solid #cbd5e1;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    td {
      padding: 5px 6px;
      border: 1px solid #e2e8f0;
      color: #334155;
      vertical-align: middle;
    }

    tr:nth-child(even) td {
      background: #f8fafc;
    }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 6.5pt;
      font-weight: 700;
      text-align: center;
      white-space: nowrap;
    }

    .badge-super { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .badge-country { background: #e0e7ff; color: #3730a3; border: 1px solid #a5b4fc; }
    .badge-branch { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
    .badge-clearing { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-user { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    .badge-active { background: #dcfce7; color: #166534; }

    .vault-mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7pt;
      background: #f1f5f9;
      padding: 1px 4px;
      border-radius: 3px;
      color: #0f172a;
      font-weight: 600;
    }

    .footer-note {
      margin-top: 14px;
      font-size: 7pt;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <div class="header-box">
    <div>
      <div class="title">Country / Branch Login Access Register</div>
      <div class="subtitle">ACCOUNTS.DGT.LLC Enterprise Resource Planning — Centralized Multi-Tier Access Matrix</div>
    </div>
    <div class="security-badge">
      <div>🔒 Super Admin Restricted</div>
      <div style="font-size: 6.5pt; font-weight: 400; color: #cbd5e1; margin-top: 2px;">Generated: ${timestamp}</div>
    </div>
  </div>

  <div class="info-bar">
    <strong>CONFIDENTIAL SECURITY POLICY:</strong> In compliance with enterprise credential management standards, plaintext passwords are never stored, exported, or transmitted. All accounts link to the approved Password Vault via the <strong>Password Vault Reference / Credential ID</strong>. Use the official Identity Provider or Vault Key to reset or provision credentials.
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 11%;">Country</th>
        <th style="width: 12%;">Main Branch</th>
        <th style="width: 11%;">City Branch</th>
        <th style="width: 13%;">User / Responsible Person</th>
        <th style="width: 9%;">Role</th>
        <th style="width: 13%;">Username / Login ID</th>
        <th style="width: 14%;">Assigned Permissions</th>
        <th style="width: 9%;">Vault Ref ID</th>
        <th style="width: 8%;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${COUNTRY_BRANCH_ACCESS_REGISTER.map(row => {
        let roleBadgeClass = "badge-user";
        if (row.role === "Super Admin") roleBadgeClass = "badge-super";
        else if (row.role === "Country Admin") roleBadgeClass = "badge-country";
        else if (row.role === "Main Branch Admin") roleBadgeClass = "badge-branch";
        else if (row.role === "Clearing Agent") roleBadgeClass = "badge-clearing";

        return `
        <tr>
          <td><strong>${row.country}</strong></td>
          <td>${row.mainBranch}</td>
          <td>${row.cityBranch}</td>
          <td><strong>${row.responsiblePerson}</strong></td>
          <td><span class="badge ${roleBadgeClass}">${row.role}</span></td>
          <td style="font-family: 'JetBrains Mono', monospace; font-size: 7pt;">${row.username}</td>
          <td style="font-size: 6.8pt; color: #475569;">${row.assignedPermissions}</td>
          <td><span class="vault-mono">${row.passwordVaultRef}</span></td>
          <td><span class="badge badge-active">${row.status}</span></td>
        </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="footer-note">
    <div><strong>Total Registered Login Accounts:</strong> ${COUNTRY_BRANCH_ACCESS_REGISTER.length} | <strong>Countries Covered:</strong> UAE, Pakistan, Afghanistan, India, Iran, Global</div>
    <div>DGT LLC Enterprise Security & Access Governance</div>
  </div>

</body>
</html>
`;

  const htmlPath = path.join(process.cwd(), 'COUNTRY_BRANCH_LOGIN_ACCESS_REGISTER.html');
  const pdfPath = path.join(process.cwd(), 'COUNTRY_BRANCH_LOGIN_ACCESS_REGISTER.pdf');
  const publicPdfPath = path.join(process.cwd(), 'public', 'reports', 'COUNTRY_BRANCH_LOGIN_ACCESS_REGISTER.pdf');

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  let execPath = edgePaths.find(p => fs.existsSync(p));

  const browser = await chromium.launch({
    executablePath: execPath,
    headless: true
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  await page.pdf({
    path: pdfPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '10mm',
      right: '10mm'
    }
  });

  await browser.close();
  console.log('✅ Generated Access Register PDF at:', pdfPath);

  const publicDir = path.join(process.cwd(), 'public', 'reports');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(pdfPath, publicPdfPath);
  console.log('✅ Copied to public reports:', publicPdfPath);

  const artifactDir = 'C:\\Users\\dgtll\\.gemini\\antigravity-ide\\brain\\c3e0251c-b7a3-4876-8e92-09612fef0ee2';
  if (fs.existsSync(artifactDir)) {
    const artifactPdf = path.join(artifactDir, 'COUNTRY_BRANCH_LOGIN_ACCESS_REGISTER.pdf');
    fs.copyFileSync(pdfPath, artifactPdf);
    console.log('✅ Copied to artifact directory:', artifactPdf);
  }
}

generateAccessRegisterPdf().catch(console.error);
