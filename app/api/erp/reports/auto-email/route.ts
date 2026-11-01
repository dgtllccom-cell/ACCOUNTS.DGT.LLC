import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { savedReports, reportAutoEmailConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendBranchEmail } from "@/lib/email/titan-smtp-service";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { authorize } from "@/lib/permissions/middleware";
import { and } from "drizzle-orm";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const failure = (error: any) => NextResponse.json({ error: error?.message || "Request failed" }, { status: error?.status === 403 ? 403 : 500 });

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
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const { searchParams } = new URL(req.url);
    const savedReportId = searchParams.get("savedReportId");
    if (!savedReportId) {
      return NextResponse.json({ error: "savedReportId is required" }, { status: 400 });
    }
    const [owned] = await db.select({ id: savedReports.id }).from(savedReports).where(and(eq(savedReports.id, savedReportId), eq(savedReports.userId, session.userId)));
    if (!owned) return NextResponse.json({ error: "Saved report not found" }, { status: 404 });

    const rows = await db
      .select()
      .from(reportAutoEmailConfigs)
      .where(eq(reportAutoEmailConfigs.savedReportId, savedReportId));

    return NextResponse.json({ success: true, data: rows[0] ?? null });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return failure(error);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const body = await req.json();
    const { savedReportId, recipients, frequency, format } = body;

    if (!savedReportId || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "savedReportId and at least one recipient are required" }, { status: 400 });
    }
    if (recipients.length > 10 || recipients.some((r: unknown) => typeof r !== "string" || !EMAIL_RE.test(r.trim()))) {
      return NextResponse.json({ error: "Recipients must be up to 10 valid email addresses" }, { status: 400 });
    }

    const [report] = await db.select().from(savedReports).where(and(eq(savedReports.id, savedReportId), eq(savedReports.userId, session.userId)));
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
    rethrowIfNextControlFlow(error);
    return failure(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const body = await req.json();

    if (action === "send-now") {
      const { recipients, reportName, htmlBody, attachment } = body;
      if (!Array.isArray(recipients) || recipients.length === 0 || !htmlBody) {
        return NextResponse.json({ error: "recipients and htmlBody are required" }, { status: 400 });
      }
      if (recipients.length > 10 || recipients.some((r: unknown) => typeof r !== "string" || !EMAIL_RE.test(r.trim()))) {
        return NextResponse.json({ error: "Recipients must be up to 10 valid email addresses" }, { status: 400 });
      }
      if (String(htmlBody).length > 400_000) {
        return NextResponse.json({ error: "The message body is too large" }, { status: 413 });
      }
      // a real PDF attachment (the report the user is looking at), never a link or an empty composer
      let attachments: Array<{ filename: string; content: Buffer; contentType: string }> | undefined;
      if (attachment) {
        const bytes = Buffer.from(String(attachment.contentBase64 || ""), "base64");
        if (bytes.length < 100 || bytes.length > MAX_ATTACHMENT_BYTES || bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
          return NextResponse.json({ error: "The attachment is not a valid PDF (or is larger than 8 MB)" }, { status: 400 });
        }
        const safe = String(attachment.filename || "report.pdf").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);
        attachments = [{ filename: /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`, content: bytes, contentType: "application/pdf" }];
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
          subject: `Report: ${String(reportName || "Custom Report").slice(0, 150)}`,
          bodyHtml: htmlBody,
          attachments
        });
        results.push({ to: recipientEmail, ...result });
      }

      const anyFailed = results.some((r) => !r.success);
      return NextResponse.json({ success: !anyFailed, attached: Boolean(attachments), results });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return failure(error);
  }
}
