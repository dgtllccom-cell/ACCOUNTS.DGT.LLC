import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hash } from "bcrypt";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createSupabaseAdminClient() as any;
    const { data: users, error } = await admin
      .from("erp_public_mail_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ data: { users }, ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { username, displayName, password, storageQuotaMb, planType } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient() as any;

    // Check username availability
    const existing = await admin
      .from("erp_public_mail_users")
      .select("id")
      .eq("username", username.toLowerCase())
      .limit(1)
      .single();

    if (existing.data) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 10);

    // Create account
    const { data: user, error: createError } = await admin
      .from("erp_public_mail_users")
      .insert({
        username: username.toLowerCase(),
        email_address: `${username.toLowerCase()}@dgt.llc`,
        password_hash: passwordHash,
        display_name: displayName || username,
        status: "active",
        storage_quota_mb: storageQuotaMb || 1000,
        storage_used_mb: 0,
        plan_type: planType || "free"
      })
      .select()
      .single();

    if (createError) throw new Error(createError.message);

    return NextResponse.json(
      { data: { user }, ok: true },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
