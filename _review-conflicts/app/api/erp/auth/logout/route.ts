import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("erp_session_id");
  cookieStore.delete("erp_refresh_token");

  return NextResponse.json({ success: true, message: "Logged out successfully" });
}
