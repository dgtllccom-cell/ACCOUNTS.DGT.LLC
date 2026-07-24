import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { listMonitorEvents, logMonitorEvent } from "@/lib/monitoring/events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 50);
    const events = await listMonitorEvents(Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ ok: true, data: events });
  } catch (error: any) {
    const code = error?.status === 401 ? 401 : 500;
    return NextResponse.json({ ok: false, error: { code: "monitor_history_failed", message: error?.message || "Failed to load history" } }, { status: code });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    if (!body?.eventType || !body?.title) {
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "eventType and title are required" } }, { status: 400 });
    }
    await logMonitorEvent({
      eventType: String(body.eventType),
      severity: body.severity,
      title: String(body.title),
      details: body.details ?? null,
      branch: body.branch ?? null,
      commitId: body.commitId ?? null,
      userId: session.userId,
      userName: session.fullName || session.email
    });
    return NextResponse.json({ ok: true, data: { logged: true } });
  } catch (error: any) {
    const code = error?.status === 401 ? 401 : 500;
    return NextResponse.json({ ok: false, error: { code: "monitor_log_failed", message: error?.message || "Failed to log event" } }, { status: code });
  }
}
