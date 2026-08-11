import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { savedReports, reportAutoEmailConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendBranchEmail } from "@/lib/email/titan-smtp-service";

export const dynamic = "force-dynamic";

// Auto Email — "Setup Auto Email" from the Report View menu. This route stores the
// recipients/frequency/format configuration against a saved report (config only — actually
// *firing* this on a schedule needs an external cron/scheduler invoking this route or a
// dedicated send job, which this Next.js app does not run; that part is NOT implemented or
// tested here). What IS real and testable today: GET/POST to manage the saved config, and
// PATCH ?action=send-now, which sends one real email immediately via the existing SMTP
// service — proving recipients/config/email delivery actually work end-to-end.

export async function GET(req: Request) {
  try {
    await requireErpSession();
    const { searchParams } = new URL(req.url);
    const savedReportId = searchParams.get("savedReportId");
    if (!savedReportId) {
      return NextResponse.json({ error: "savedReportId is required" }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(reportAutoEmailConfigs)
      .where(eq(reportAutoEmailConfigs.savedReportId, savedReportId));

    return NextResponse.json({ success: true, data: rows[0] ?? null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    const body = await req.json();
    const { savedReportId, recipients, frequency, format } = body;

    if (!savedReportId || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "savedReportId and at least one recipient are required" }, { status: 400 });
    }

    const [report] = await db.select().from(savedReports).where(eq(savedReports.id, savedReportId));
    if (!report) {
      return NextResponse.json({ error: "Saved report not found" }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(reportAutoEmailConfigs)
      .where(eq(reportAutoEmailConfigs.savedReportId, savedReportId));

    let row;
    if (existing[0]) {
      [row] = await db
        .update(reportAutoEmailConfigs)
        .set({ recipients, frequency: frequency || "daily", format: format || "pdf", isActive: true, updatedAt: new Date() })
        .where(eq(reportAutoEmailConfigs.id, existing[0].id))
        .returning();
    } else {
      [row] = await db
        .insert(reportAutoEmailConfigs)
        .values({
          savedReportId,
          recipients,
          frequency: frequency || "daily",
          format: format || "pdf",
          createdBy: session.userId
        })
        .returning();
    }

    return NextResponse.json({ success: true, data: row });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const body = await req.json();

    if (action === "send-now") {
      const { recipients, reportName, htmlBody } = body;
      if (!Array.isArray(recipients) || recipients.length === 0 || !htmlBody) {
        return NextResponse.json({ error: "recipients and htmlBody are required" }, { status: 400 });
      }
      if (!session.email) {
        return NextResponse.json({ error: "Your account has no sender email configured — cannot send." }, { status: 400 });
      }
      const countryId = session.countryIds[0];
      const branchId = session.countryBranchIds[0] || session.cityBranchIds[0];
      if (!countryId || !branchId) {
        return NextResponse.json({ error: "No country/branch assignment found for the sending account — cannot send." }, { status: 400 });
      }

      const results = [];
      for (const recipientEmail of recipients) {
        const result = await sendBranchEmail({
          countryId,
          branchId,
          senderUserId: session.userId,
          senderEmail: session.email,
          recipientEmail,
          subject: `Report: ${reportName || "Custom Report"}`,
          bodyHtml: htmlBody
        });
        results.push({ to: recipientEmail, ...result });
      }

      const anyFailed = results.some((r) => !r.success);
      return NextResponse.json({ success: !anyFailed, results });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
