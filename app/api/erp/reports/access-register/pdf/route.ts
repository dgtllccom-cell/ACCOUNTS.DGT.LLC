import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { getAccessRegisterData } from "@/lib/repositories/access-register-repository";
import { buildSimpleTablePdf } from "@/lib/reports/simple-pdf";

/**
 * Country & Branch Login Access Register.
 *
 * Always LIVE-RENDERED from `user_role_assignments` — no stale static file is
 * ever served. The default response is a real `application/pdf` download built
 * on the fly; `?format=html` returns the printable HTML view (Print / Save-as-PDF
 * stays a separate action for anyone who wants the browser dialog).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Super Admin access required for the Access Register" }, { status: 403 });
    }

    const rows = await getAccessRegisterData();
    const format = request.nextUrl.searchParams.get("format");
    const generatedAt = new Date();

    if (format === "html") {
      const rowsHtml = rows
        .map(
          (r) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; font-weight: bold;">${escapeHtml(r.country)}</td>
        <td style="padding: 6px 8px;">${escapeHtml(r.mainBranch)}</td>
        <td style="padding: 6px 8px;">${escapeHtml(r.cityBranch)}</td>
        <td style="padding: 6px 8px; font-weight: 600;">${escapeHtml(r.responsiblePerson)}</td>
        <td style="padding: 6px 8px;"><span style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${escapeHtml(r.role)}</span></td>
        <td style="padding: 6px 8px; font-family: monospace;">${escapeHtml(r.username)}</td>
        <td style="padding: 6px 8px;"><span style="background: ${r.status === "Active" ? "#dcfce7" : "#fee2e2"}; color: ${r.status === "Active" ? "#166534" : "#991b1b"}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${escapeHtml(r.status)}</span></td>
      </tr>`,
        )
        .join("");

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
        <span style="font-size: 12px; color: #64748b;">Enterprise Access Register — ${rows.length} entries · generated ${generatedAt.toISOString().slice(0, 19).replace("T", " ")} UTC</span>
      </div>
      <div style="border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
        <h2 style="margin: 0; color: #0f172a;">Country &amp; Branch Login Access Register</h2>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">DGT LLC Accounts ERP — Global Credential Register &amp; Permission Hierarchy</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Country</th><th>Main Branch</th><th>City Branch</th><th>Responsible Person</th>
            <th>Role</th><th>Username / Login ID</th><th>Status</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <script>window.onload = () => { if (!window.location.search.includes('noprint')) setTimeout(() => window.print(), 500); }</script>
    </body>
    </html>`;
      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    // Default: a real PDF file, built from current data every time.
    const pdf = buildSimpleTablePdf({
      title: "Country & Branch Login Access Register",
      subtitle: `DGT LLC Accounts ERP — Global Credential Register & Permission Hierarchy · ${rows.length} entries`,
      generatedAt,
      columns: [
        { header: "Country", value: (r) => String(r.country ?? ""), width: 1.1 },
        { header: "Main Branch", value: (r) => String(r.mainBranch ?? ""), width: 1.3 },
        { header: "City Branch", value: (r) => String(r.cityBranch ?? ""), width: 1.3 },
        { header: "Responsible Person", value: (r) => String(r.responsiblePerson ?? ""), width: 1.5 },
        { header: "Role", value: (r) => String(r.role ?? ""), width: 1.1 },
        { header: "Username / Login ID", value: (r) => String(r.username ?? ""), width: 1.6 },
        { header: "Status", value: (r) => String(r.status ?? ""), width: 0.7 },
      ],
      rows: rows as unknown as Array<Record<string, unknown>>,
      note: `This register is generated live from user_role_assignments. Credentials themselves are never included — usernames only. ${rows.length} active assignment(s) at generation time.`,
    });

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Country_Branch_Login_Access_Register_${generatedAt.toISOString().slice(0, 10)}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to build the Access Register";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
