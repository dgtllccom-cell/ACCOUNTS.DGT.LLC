import { NextRequest, NextResponse } from "next/server";
import { getUserMessages, sendWebmailMessage, saveDraft } from "@/lib/public-mail/webmail-service";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get("dgt_mail_user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const folder = searchParams.get("folder") || "inbox";
  const search = searchParams.get("q") || "";

  try {
    const messages = await getUserMessages(userId, folder, search);
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get("dgt_mail_user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, to, subject, body: emailBody, attachments, draftId } = body;

    // Handle Save Draft
    if (action === "draft") {
      const draftResult = await saveDraft({
        userId,
        draftId,
        to: to || "",
        subject: subject || "",
        body: emailBody || "",
        attachments: attachments || [],
      });
      if (!draftResult.success) {
        return NextResponse.json({ error: draftResult.error || "Failed to save draft" }, { status: 400 });
      }
      return NextResponse.json({ success: true, draftId: draftResult.draftId });
    }

    // Normal Send
    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: "Recipient, subject, and message body are required" }, { status: 400 });
    }

    const result = await sendWebmailMessage({
      userId,
      to,
      subject,
      body: emailBody,
      attachments,
      draftId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to send message" }, { status: 400 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
