import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return NextResponse.json({
    hasSecret: Boolean(secret),
    prefix: secret ? secret.slice(0, 12) : null,
    hasPublic: Boolean((process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()),
    ref: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").includes("csesvyxxjivnkkozgopt") ? "csesvyxxjivnkkozgopt" : null
  });
}
