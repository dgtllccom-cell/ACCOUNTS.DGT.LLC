import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { requireErpSession } from "@/lib/auth/session";
import { collectGit } from "@/lib/monitoring/collectors";
import { getMonitorStatus } from "@/lib/monitoring/status";
import { recordEnterpriseMultilingualEvent } from "@/lib/services/enterprise-multilingual-service";
import { MONITOR_SOURCE_MODULE } from "@/lib/monitoring/history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execAsync = promisify(exec);
const PM2_APP = process.env.PM2_APP_NAME || "dgt-nextjs";

async function runCommand(cmd: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 20000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return (stdout || stderr || "done").toString().slice(0, 2000);
  } catch (e: any) {
    throw new Error(e?.stderr?.toString?.() || e?.message || `Command failed: ${cmd}`);
  }
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireErpSession();
  } catch {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Authentication required" } }, { status: 401 });
  }

  if (!session.isSuperAdmin) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Super admin privileges are required" } }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  const git = await collectGit().catch(() => null);
  const actorName = session.fullName || session.email || session.userId;

  async function logEvent(eventType: string, severity: "info" | "warning" | "error", message: string, extra: Record<string, unknown>) {
    try {
      await recordEnterpriseMultilingualEvent(session as any, {
        eventType,
        severity,
        sourceModule: MONITOR_SOURCE_MODULE,
        message,
        messageLanguage: "en",
        payload: { branch: git?.branch ?? null, commitId: git?.commitShort ?? null, actorName, ...extra },
        notifyEmail: false,
        notifyMobile: false
      });
    } catch {
      /* logging must never break the action response */
    }
  }

  try {
    switch (action) {
      case "restart-app": {
        const output = await runCommand(`pm2 restart ${PM2_APP}`);
        await logEvent("restart_app", "warning", `Application restarted (${PM2_APP})`, { output });
        return NextResponse.json({ ok: true, data: { action, output } });
      }
      case "restart-pm2": {
        const output = await runCommand("pm2 restart all");
        await logEvent("restart_pm2", "warning", "PM2 processes restarted (all)", { output });
        return NextResponse.json({ ok: true, data: { action, output } });
      }
      case "health-check": {
        const status = await getMonitorStatus();
        await logEvent("health_check", status.overall === "error" ? "error" : status.overall === "warning" ? "warning" : "info", `Health check run — overall: ${status.overall}`, { overall: status.overall });
        return NextResponse.json({ ok: true, data: { action, status } });
      }
      default:
        return NextResponse.json({ ok: false, error: { code: "unknown_action", message: `Unknown action: ${action}` } }, { status: 400 });
    }
  } catch (error: any) {
    await logEvent(action.replace(/-/g, "_") || "action", "error", `Action failed: ${action}`, { error: error?.message || "unknown" });
    return NextResponse.json({ ok: false, error: { code: "action_failed", message: error?.message || "Action failed" } }, { status: 500 });
  }
}
