import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/public-mail/crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient() as any;

    // Find user by email
    const { data: user, error: userError } = await admin
      .from("erp_public_mail_users")
      .select("id, username, email_address, password_hash, display_name, status")
      .ilike("email_address", email.toLowerCase())
      .is("deleted_at", null)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 403 }
      );
    }

    // Verify password
    const passwordValid = verifyPassword(password, user.password_hash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Update last login
    await admin
      .from("erp_public_mail_users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user.id);

    // Return user data (no password)
    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email_address,
          displayName: user.display_name
        }
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Public mail login error:", error);
    return NextResponse.json(
      { error: error.message || "Login failed" },
      { status: 500 }
    );
  }
}
