import { NextRequest, NextResponse } from "next/server";
import { resetUserPassword } from "@/lib/public-mail/webmail-service";

export async function POST(req: NextRequest) {
  try {
    const { usernameOrEmail, newPassword } = await req.json();

    if (!usernameOrEmail || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Username/email and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    const result = await resetUserPassword({
      usernameOrEmail,
      newPassword,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Password reset failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
