import { NextRequest, NextResponse } from "next/server";
import { registerPublicMailUser, isUsernameAvailable, validateUsername } from "@/lib/public-mail/webmail-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username") || "";

  const check = validateUsername(username);
  if (!check.valid) {
    return NextResponse.json({ available: false, reason: check.reason });
  }

  const available = await isUsernameAvailable(username);
  return NextResponse.json({
    available,
    reason: available ? "Username is available" : "This username is already taken",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, displayName, recoveryEmail, phoneNumber, planId } = body;

    if (!username || !password || !displayName) {
      return NextResponse.json(
        { success: false, error: "Username, password, and display name are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const result = await registerPublicMailUser({
      username,
      password,
      displayName,
      recoveryEmail,
      phoneNumber,
      planId,
    });

    if (!result.success || !result.user) {
      return NextResponse.json({ success: false, error: result.error || "Registration failed" }, { status: 400 });
    }

    // Set auth cookie
    const response = NextResponse.json({ success: true, user: result.user });
    response.cookies.set("dgt_mail_user_id", result.user.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
