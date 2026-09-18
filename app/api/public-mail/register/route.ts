import { NextRequest, NextResponse } from "next/server";
import { createMailbox, checkEmailAvailable, suggestEmail } from "@/lib/mail-provisioning/create-mailbox";

/**
 * POST /api/public-mail/register
 * Public user registration - creates real DGT @dgt.llc mailbox
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, displayName, password } = body;

    if (!username || !displayName) {
      return NextResponse.json(
        { error: "username and displayName required" },
        { status: 400 }
      );
    }

    // Validate username
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return NextResponse.json(
        { error: "Invalid username. Use 3-32 chars: a-z, 0-9, ., -, _" },
        { status: 400 }
      );
    }

    // Build email
    const emailAddress = `${username}@dgt.llc`;

    // Check availability
    const available = await checkEmailAvailable(emailAddress);
    if (!available) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // Create real mailbox
    const result = await createMailbox({
      emailAddress,
      displayName,
      purpose: "public_registration"
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Provisioning failed" },
        { status: 500 }
      );
    }

    // Return credentials to client (only time shown)
    // Client must securely store or use immediately
    return NextResponse.json({
      ok: true,
      data: {
        emailAddress: result.emailAddress,
        password: result.password, // IMPORTANT: Only shown once
        displayName,
        created: new Date().toISOString(),
        nextSteps: ["Verify email", "Configure mailbox", "Enable IMAP/SMTP"]
      }
    }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/public-mail/register/check
 * Check username availability
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return NextResponse.json(
        { error: "username required" },
        { status: 400 }
      );
    }

    const emailAddress = `${username}@dgt.llc`;
    const available = await checkEmailAvailable(emailAddress);

    return NextResponse.json({
      ok: true,
      username,
      emailAddress,
      available
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
