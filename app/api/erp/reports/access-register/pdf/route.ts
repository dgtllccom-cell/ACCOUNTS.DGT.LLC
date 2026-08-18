import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { COUNTRY_BRANCH_ACCESS_REGISTER } from "@/lib/repositories/access-register-repository";

export async function GET(request: NextRequest) {
  try {
    const pdfPath = path.join(process.cwd(), "public", "reports", "COUNTRY_BRANCH_LOGIN_ACCESS_REGISTER.pdf");
    const rootPdfPath = path.join(process.cwd(), "COUNTRY_BRANCH_LOGIN_ACCESS_REGISTER.pdf");

    let finalPath = pdfPath;
    if (!fs.existsSync(finalPath) && fs.existsSync(rootPdfPath)) {
      finalPath = rootPdfPath;
    }

    if (fs.existsSync(finalPath)) {
      const fileBuffer = fs.readFileSync(finalPath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="Country_Branch_Login_Access_Register.pdf"',
          "Cache-Control": "no-store, no-cache, must-revalidate"
        }
      });
    }

    // Dynamic HTML Printable Fallback
    const rowsHtml = COUNTRY_BRANCH_ACCESS_REGISTER.map(
      (r, i) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; font-weight: bold;">${r.country}</td>
        <td style="padding: 6px 8px;">${r.mainBranch}</td>
        <td style="padding: 6px 8px;">${r.cityBranch}</td>
        <td style="padding: 6px 8px; font-weight: 600;">${r.responsiblePerson}</td>
        <td style="padding: 6px 8px;"><span style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${r.role}</span></td>
        <td style="padding: 6px 8px; font-family: monospace;">${r.username}</td>
        <td style="padding: 6px 8px; font-family: monospace; font-size: 10px; color: #4338ca;">${r.passwordVaultRef}</td>
        <td style="padding: 6px 8px;"><span style="background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${r.status}</span></td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Country & Branch Login Access Register</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #1e293b; color: #ffffff; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
        <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">Print / Save as PDF</button>
        <span style="font-size: 12px; color: #64748b;">Enterprise Access Register</span>
      </div>
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
        <h2 style="margin: 0; color: #0f172a;">Country & Branch Login Access Register</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">DGT LLC Accounts ERP — Global Credential Register & Permission Hierarchy</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Country</th>
            <th>Main Branch</th>
            <th>City Branch</th>
            <th>Responsible Person</th>
            <th>Role</th>
            <th>Username / Login ID</th>
            <th>Vault Ref / Credential ID</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <script>window.onload = () => { if (!window.location.search.includes('noprint')) setTimeout(() => window.print(), 500); }</script>
    </body>
    </html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to serve Access Register document" }, { status: 500 });
  }
}
