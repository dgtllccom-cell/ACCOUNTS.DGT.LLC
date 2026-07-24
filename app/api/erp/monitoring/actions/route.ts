import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { requireSession } from "@/lib/auth/session";
import { logMonitorEvent } from "@/lib/monitoring/events";
import { collectGit } from "@/lib/monitoring/collectors";
import { getMonitorStatus } from "@/lib/monitoring/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execAsync = promisify(exec);
const PM2_APP = process.env.PM2_APP_NAME || "dgt-nextjs";

type ActionResult = { ran: string; output: string };

async function runCommand(cmd: string): Promise<ActionResult> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 20000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return { ran: cmd, output: (stdout || stderr || "done").toString().slice(0, 2000) };
  } catch (e: any) {
    throw new Error(e?.stderr?.toString?.() || e?.message || `Command failed: ${cmd}`);
  }
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Authentication required" } }, { status: 401 });
  }

  // Destructive / privileged operations are restricted to super admins.
  if (!session.isSuperAdmin) {
    return NextResponse.json({ ok: false, error: { code: "forbidden", message: "Super admin privileges are required for this action" } }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  const git = await collectGit().catch(() => null);
  const actor = session.fullName || session.email || session.userId;

  try {
    let result: ActionResult | null = null;
    let title = "";
    let severity: "healthy" | "warning" | "error" | "info" = "info";

    switch (action) {
      case "restart-app": {
        result = await runCommand(`pm2 restart ${PM2_APP}`);
        title = `Application restarted (${PM2_APP})`;
        severity = "warning";
        break;
      }
      case "restart-pm2": {
        result = await runCommand("pm2 restart all");
        title = "PM2 processes restarted (all)";
        severity = "warning";
        break;
      }
      case "health-check": {
        const status = await getMonitorStatus();
        title = `Health check run — overall: ${status.overall}`;
        severity = status.overall === "unknown" ? "info" : status.overall;
        await logMonitorEvent({
          eventType: "health_check",
          severity,
          title,
          details: { overall: status.overall, metrics: status.metrics.map((m) => ({ label: m.label, value: m.value, status: m.status })) },
          branch: git?.branch ?? null,
          commitId: git?.commitShort ?? null,
          userId: session.userId,
          userName: actor
        });
        return NextResponse.json({ ok: true, data: { action, status } });
      }
      default:
        return NextResponse.json({ ok: false, error: { code: "unknown_action", message: `Unknown action: ${action}` } }, { status: 400 });
    }

    await logMonitorEvent({
      eventType: action.replace(/-/g, "_"),
      severity,
      title,
      details: { output: result?.output ?? "" },
      branch: git?.branch ?? null,
      commitId: git?.commitShort ?? null,
      userId: session.userId,
      userName: actor
    });

    return NextResponse.json({ ok: true, data: { action, result } });
  } catch (error: any) {
    await logMonitorEvent({
      eventType: action.replace(/-/g, "_") || "action",
      severity: "error",
      title: `Action failed: ${action}`,
      details: { error: error?.message || "unknown error" },
      branch: git?.branch ?? null,
      commitId: git?.commitShort ?? null,
      userId: session.userId,
      userName: actor
    });
    return NextResponse.json({ ok: false, error: { code: "action_failed", message: error?.message || "Action failed" } }, { status: 500 });
  }
}
