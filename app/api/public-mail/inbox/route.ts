import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/public-mail/inbox
 * Fetch inbox messages for authenticated public mail user.
 * Auth: Bearer token from public_mail_token cookie/header
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // In a real system, verify token against sessions table
    // For now, return empty inbox (no real mail server integrated yet)
    return NextResponse.json({
      ok: true,
      messages: [],
      total: 0,
      unread: 0
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch inbox" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/public-mail/inbox
 * Send email from public mail account.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { to, subject, body: messageBody } = body;

    if (!to || !subject || !messageBody) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // In a real system, integrate with mail server to send email
    // For now, return mock success
    return NextResponse.json({
      ok: true,
      messageId: `msg-${Date.now()}`,
      sent: true
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
