import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { chromium } from "playwright";

function loadEnv() {
  const content = fs.readFileSync ? fs.readFileSync(".env.local", "utf8") : "";
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

// In case fs is not fully imported, standard read
import fsStandard from "node:fs";
const content = fsStandard.readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  content
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

async function generateReport() {
  try {
    console.log("Fetching standardized structure data from database...");

    // 1. Fetch Countries & Main Branches
    const countries = await sql`
      SELECT id, name, currency_code
      FROM countries
      WHERE name IN ('Islamic Republic of Pakistan', 'United Arab Emirates (UAE)', 'Islamic Republic of Afghanistan', 'Republic of India')
      AND deleted_at IS NULL
      ORDER BY name
    `;

    const countryBranches = await sql`
      SELECT id, country_id, name, code, local_currency
      FROM country_branches
      WHERE country_id IN ${sql(countries.map(c => c.id))}
      AND deleted_at IS NULL
    `;

    const cityBranches = await sql`
      SELECT id, country_id, country_branch_id, city_name, name, code, local_currency
      FROM city_branches
      WHERE country_id IN ${sql(countries.map(c => c.id))}
      AND deleted_at IS NULL
      ORDER BY city_name
    `;

    // 2. Fetch Assignments & Profiles
    const assignments = await sql`
      SELECT ura.user_id, ura.role, ura.country_id, ura.city_branch_id, p.full_name, p.user_code, p.raw_password, au.email
      FROM user_role_assignments ura
      LEFT JOIN profiles p ON p.id = ura.user_id
      LEFT JOIN auth.users au ON au.id = ura.user_id
      WHERE ura.is_active = true AND ura.deleted_at IS NULL
    `;

    await sql.end();

    console.log("Formatting HTML report...");

    // Build lists
    const targetCountries = countries.map(country => {
      const mainBranch = countryBranches.find(cb => cb.country_id === country.id);
      const cAdmin = assignments.find(a => a.role === 'country_admin' && a.country_id === country.id);
      const shortCode = country.name.toLowerCase().includes("pakistan") ? "PAK" :
                        country.name.toLowerCase().includes("emirates") ? "UAE" :
                        country.name.toLowerCase().includes("afghanistan") ? "AFG" : "IND";

      const countryBranchesList = cityBranches.filter(cb => cb.country_id === country.id);
      const branchesData = countryBranchesList.map(cb => {
        const bAdmin = assignments.find(a => a.role === 'city_branch_admin' && a.city_branch_id === cb.id);
        return {
          code: cb.code,
          cityName: cb.city_name,
          branchName: cb.name,
          currency: cb.local_currency,
          username: bAdmin ? bAdmin.email : "-",
          password: bAdmin ? bAdmin.raw_password : "-"
        };
      });

      return {
        name: country.name,
        code: shortCode,
        currency: country.currency_code,
        adminUser: cAdmin ? cAdmin.email : "-",
        adminPassword: cAdmin ? cAdmin.raw_password : "-",
        branches: branchesData
      };
    });

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DGT Standard User Access & Branch Structure Report</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.5;
    }
    .header {
      background-color: #0f172a;
      color: white;
      padding: 24px;
      border-bottom: 4px solid #3b82f6;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.025em;
      text-transform: uppercase;
    }
    .header p {
      margin: 4px 0 0 0;
      font-size: 11px;
      color: #94a3b8;
      font-weight: 600;
    }
    .content {
      padding: 24px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 8px 10px;
      text-align: left;
      border: 1px solid #cbd5e1;
    }
    th {
      background-color: #f8fafc;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 9px;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: bold;
      color: #0f766e;
    }
    .password-badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background-color: #fef3c7;
      color: #92400e;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: bold;
    }
    .role-badge {
      font-size: 9px;
      font-weight: 800;
      background-color: #dbeafe;
      color: #1e40af;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      font-size: 9px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DGT Global Logistics LLC</h1>
    <p>Standard Branch & User Structure Credentials Report (A4)</p>
  </div>
  
  <div class="content">
    <div class="section-title">1. Super Admin Account</div>
    <table>
      <thead>
        <tr>
          <th>Role</th>
          <th>Full Name</th>
          <th>Username / Email</th>
          <th>Password</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="role-badge" style="background-color:#f1f5f9; color:#334155;">Super Admin</span></td>
          <td>Super Admin</td>
          <td class="font-mono">superadmin@damaan.com</td>
          <td><span class="password-badge">admin123</span></td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">2. Country Administrator Accounts</div>
    <table>
      <thead>
        <tr>
          <th>Country</th>
          <th>Country Code</th>
          <th>Role</th>
          <th>Username / Email</th>
          <th>Password</th>
        </tr>
      </thead>
      <tbody>
        ${targetCountries.map(c => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td class="font-mono">${c.code}</td>
            <td><span class="role-badge" style="background-color:#f0fdf4; color:#166534;">Country Admin</span></td>
            <td class="font-mono">${c.adminUser}</td>
            <td><span class="password-badge">${c.adminPassword}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="section-title">3. City Branch Access Accounts</div>
    <table>
      <thead>
        <tr>
          <th>Country</th>
          <th>City</th>
          <th>Branch Name</th>
          <th>Branch Code</th>
          <th>Currency</th>
          <th>Branch Admin Email</th>
          <th>Password</th>
        </tr>
      </thead>
      <tbody>
        ${targetCountries.flatMap(c => 
          c.branches.map(b => `
            <tr>
              <td>${c.name}</td>
              <td><strong>${b.cityName}</strong></td>
              <td>${b.branchName}</td>
              <td class="font-mono">${b.code}</td>
              <td class="font-mono">${b.currency}</td>
              <td class="font-mono">${b.username}</td>
              <td><span class="password-badge">${b.password}</span></td>
            </tr>
          `)
        ).join('')}
      </tbody>
    </table>

    <div class="footer">
      Generated on ${new Date().toLocaleString()} | Security Classification: Restricted Business Credentials Report
    </div>
  </div>
</body>
</html>
    `;

    const htmlPath = path.join(process.cwd(), "scripts/report.html");
    await fs.writeFile(htmlPath, htmlContent, "utf8");
    console.log(`Temporary HTML report written to ${htmlPath}`);

    console.log("Launching headless browser to render PDF...");
    const browser = await chromium.launch({
      headless: true,
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
    });

    const page = await browser.newPage();
    await page.goto("file://" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle" });
    
    // Save to exports directory
    const exportDir = path.join(process.cwd(), "exports");
    await fs.mkdir(exportDir, { recursive: true });
    
    const pdfPath = path.join(exportDir, "DGT_Standard_Branch_Users.pdf");
    await page.pdf({
      path: pdfPath,
      format: "A4",
      margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
      printBackground: true
    });

    console.log(`PDF successfully generated at: ${pdfPath}`);

    // Also copy to the conversation artifacts directory if available
    const artifactPath = "C:/Users/dgtll/.gemini/antigravity-ide/brain/9124e19b-9041-4566-b264-8c7a62c263e8/DGT_Standard_Branch_Users.pdf";
    await fs.copyFile(pdfPath, artifactPath);
    console.log(`PDF copied to artifact location: ${artifactPath}`);

    await browser.close();
    await fs.unlink(htmlPath); // cleanup temp html file
    console.log("Cleaned up temporary HTML file.");

  } catch (err) {
    console.error("Failed to generate PDF report:", err.message);
    console.error(err.stack);
  }
}

generateReport();
