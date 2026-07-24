/**
 * Server & Project Monitoring — event history.
 *
 * Stores every notable server event (commit, build, deploy, restart, health check, …)
 * with date, time, user, branch and details. The table is self-provisioning via
 * CREATE TABLE IF NOT EXISTS so the dashboard works in production even before a
 * formal migration has been applied.
 */
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import type { HealthStatus } from "@/lib/monitoring/collectors";

export type MonitorEvent = {
  id: string;
  eventType: string;
  severity: HealthStatus | "info";
  title: string;
  details: unknown;
  branch: string | null;
  commitId: string | null;
  userId: string | null;
  userName: string | null;
  createdAt: string;
};

let ensured = false;

export async function ensureEventsTable(): Promise<boolean> {
  if (ensured) return true;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS server_monitor_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type text NOT NULL,
        severity text NOT NULL DEFAULT 'info',
        title text NOT NULL,
        details jsonb,
        branch text,
        commit_id text,
        user_id uuid,
        user_name text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS server_monitor_events_created_at_idx ON server_monitor_events (created_at DESC)`);
    ensured = true;
    return true;
  } catch (e) {
    console.error("[monitoring] ensureEventsTable failed:", e);
    return false;
  }
}

export async function logMonitorEvent(input: {
  eventType: string;
  severity?: HealthStatus | "info";
  title: string;
  details?: unknown;
  branch?: string | null;
  commitId?: string | null;
  userId?: string | null;
  userName?: string | null;
}): Promise<void> {
  try {
    if (!(await ensureEventsTable())) return;
    await db.execute(sql`
      INSERT INTO server_monitor_events (event_type, severity, title, details, branch, commit_id, user_id, user_name)
      VALUES (
        ${input.eventType},
        ${input.severity || "info"},
        ${input.title},
        ${input.details ? JSON.stringify(input.details) : null}::jsonb,
        ${input.branch ?? null},
        ${input.commitId ?? null},
        ${input.userId ?? null},
        ${input.userName ?? null}
      )
    `);
  } catch (e) {
    console.error("[monitoring] logMonitorEvent failed:", e);
  }
}

export async function listMonitorEvents(limit = 50): Promise<MonitorEvent[]> {
  try {
    if (!(await ensureEventsTable())) return [];
    const capped = Math.min(Math.max(1, limit), 200);
    const rows: any = await db.execute(sql`
      SELECT id, event_type, severity, title, details, branch, commit_id, user_id, user_name, created_at
      FROM server_monitor_events
      ORDER BY created_at DESC
      LIMIT ${capped}
    `);
    const arr = Array.isArray(rows) ? rows : rows?.rows || [];
    return arr.map((r: any) => ({
      id: String(r.id),
      eventType: String(r.event_type),
      severity: (r.severity || "info") as MonitorEvent["severity"],
      title: String(r.title),
      details: r.details ?? null,
      branch: r.branch ?? null,
      commitId: r.commit_id ?? null,
      userId: r.user_id ?? null,
      userName: r.user_name ?? null,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)
    }));
  } catch (e) {
    console.error("[monitoring] listMonitorEvents failed:", e);
    return [];
  }
}
