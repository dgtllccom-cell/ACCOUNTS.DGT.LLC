import { NextRequest, NextResponse } from "next/server";
import { authenticatePublicMailUser, createSession, resolveSessionUserId, revokeSession } from "@/lib/public-mail/webmail-service";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await authenticatePublicMailUser(username, password);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // The cookie carries an opaque session token, never the raw user id —
    // the id is visible in admin lists/audit logs/message metadata, so using
    // it directly as the credential would let anyone who saw it impersonate
    // the account with no password check at all.
    const token = await createSession(user.id);
    const response = NextResponse.json({ success: true, user });
    response.cookies.set("dgt_mail_user_id", token, {
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

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("dgt_mail_user_id")?.value;
  const userId = await resolveSessionUserId(token);
  if (userId) await revokeSession(userId);
  const response = NextResponse.json({ success: true });
  response.cookies.delete("dgt_mail_user_id");
  return response;
}
