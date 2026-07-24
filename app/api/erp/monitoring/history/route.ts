import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { listMonitorHistory } from "@/lib/monitoring/history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    const lang = normalizeLanguage(searchParams.get("lang"), session.preferredLanguage ?? "en");
    const limit = Number(searchParams.get("limit") || 50);
    const items = await listMonitorHistory(lang, Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ ok: true, data: items });
  } catch (error: any) {
    const code = error?.status === 401 ? 401 : 500;
    return NextResponse.json({ ok: false, error: { code: "monitor_history_failed", message: error?.message || "Failed to load history" } }, { status: code });
  }
}
