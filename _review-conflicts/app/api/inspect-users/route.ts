import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        success: false,
        error: "Supabase credentials are not loaded in process.env",
        envKeys: Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("DATABASE"))
      }, { status: 200 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const action = request.nextUrl.searchParams.get("action");
    const email = request.nextUrl.searchParams.get("email");

    if (action === "delete" && email) {
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        return NextResponse.json({ success: false, error: `List users failed: ${listError.message}` }, { status: 200 });
      }

      const userToDelete = usersData.users.find(u => u.email?.trim().toLowerCase() === email.trim().toLowerCase());
      if (!userToDelete) {
        return NextResponse.json({
          success: false,
          message: `No user found with email ${email}`,
          availableEmails: usersData.users.map(u => u.email)
        }, { status: 200 });
      }

      const { error: deleteError } = await supabase.auth.admin.deleteUser(userToDelete.id);
      if (deleteError) {
        return NextResponse.json({ success: false, error: `Delete user failed: ${deleteError.message}` }, { status: 200 });
      }

      return NextResponse.json({ success: true, message: `Successfully deleted user ${email} (${userToDelete.id}) from Supabase Auth` }, { status: 200 });
    }

    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ success: false, error: listError.message }, { status: 200 });
    }

    const users = usersData.users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      user_metadata: u.user_metadata
    }));

    return NextResponse.json({ success: true, users }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 200 });
  }
}
