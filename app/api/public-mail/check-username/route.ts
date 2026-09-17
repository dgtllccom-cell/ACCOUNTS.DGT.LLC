import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.toLowerCase();

    if (!username || username.length < 3 || username.length > 20) {
      return NextResponse.json({ available: false });
    }

    // Only allow alphanumeric and dots
    if (!/^[a-z0-9.]+$/.test(username)) {
      return NextResponse.json({ available: false });
    }

    const admin = createSupabaseAdminClient() as any;
    const { data } = await admin
      .from("erp_public_mail_users")
      .select("id")
      .eq("username", username)
      .limit(1)
      .single();

    return NextResponse.json({ available: !data });
  } catch (err) {
    return NextResponse.json({ available: false });
  }
}
