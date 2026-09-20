import { NextRequest, NextResponse } from "next/server";
import { adminGetPublicMailAuditLogs } from "@/lib/public-mail/webmail-service";
import { getErpSessionForApi } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getErpSessionForApi();
    if (!session || !session.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || undefined;
    const logs = await adminGetPublicMailAuditLogs(userId);
    return NextResponse.json({ logs });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
