import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient() as any;
    const { data: mailbox } = await admin
      .from("erp_email_accounts")
      .select("id, email_address, imap_password_encrypted")
      .eq("email_address", email.toLowerCase())
      .single();

    if (!mailbox) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    const decryptedPassword = decrypt(mailbox.imap_password_encrypted);
    if (decryptedPassword !== password) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, email: mailbox.email_address }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
