import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { getMonitorStatus } from "@/lib/monitoring/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireErpSession();
    const status = await getMonitorStatus();
    return NextResponse.json({ ok: true, data: status });
  } catch (error: any) {
    const code = error?.status === 401 ? 401 : 500;
    return NextResponse.json({ ok: false, error: { code: "monitor_status_failed", message: error?.message || "Failed to load status" } }, { status: code });
  }
}
