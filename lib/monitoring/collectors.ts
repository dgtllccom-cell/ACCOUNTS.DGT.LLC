/**
 * Server & Project Monitoring — data collectors (server-only, Node runtime).
 * Each probe is individually guarded so one failure never breaks the dashboard.
 * Values returned here are TECHNICAL (numbers, hashes, hostnames) and are not
 * translated; the UI translates all labels/status words via the module dictionary.
 */
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

const execAsync = promisify(exec);

export type HealthStatus = "healthy" | "warning" | "error" | "unknown";

async function run(cmd: string, timeout = 6000): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout, windowsHide: true, maxBuffer: 1024 * 1024 });
    return (stdout || "").trim();
  } catch {
    return "";
  }
}

function pct(used: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}

function byUsage(p: number, warn = 75, err = 90): HealthStatus {
  if (p >= err) return "error";
  if (p >= warn) return "warning";
  return "healthy";
}

function fmtBytes(n: number): string {
  if (!n || n < 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

export function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function repoSlug(remote: string): string {
  const m = remote.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?/i);
  return m ? m[1] : "";
}

export async function collectGit() {
  const branch = (await run("git rev-parse --abbrev-ref HEAD")) || process.env.GITHUB_REF_NAME || "unknown";
  const commitFull = (await run("git rev-parse HEAD")) || process.env.GITHUB_SHA || "";
  const commitShort = commitFull ? commitFull.slice(0, 7) : "unknown";
  const lastMsg = await run("git log -1 --pretty=%s");
  const lastAuthor = (await run("git log -1 --pretty=%an")) || "unknown";
  const lastDate = await run("git log -1 --pretty=%cI");
  const porcelain = await run("git status --porcelain");
  const remote = (await run("git remote get-url origin")) || process.env.GITHUB_REPO_URL || "";
  const slug = process.env.GITHUB_REPO || repoSlug(remote);
  return { branch, commitShort, commitFull, lastMessage: lastMsg, lastAuthor, lastDate, dirty: Boolean(porcelain), slug, remote };
}

async function githubApi(pathname: string): Promise<any | null> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const slug = process.env.GITHUB_REPO || repoSlug(process.env.GITHUB_REPO_URL || "");
  if (!token || !slug) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://api.github.com/repos/${slug}${pathname}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "dgt-erp-monitor" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function collectGitHubActions() {
  const data = await githubApi("/actions/runs?per_page=1");
  const configured = Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
  if (!data || !Array.isArray(data.workflow_runs) || data.workflow_runs.length === 0) {
    return { configured, status: "unknown" as HealthStatus, conclusion: "" };
  }
  const runInfo = data.workflow_runs[0];
  const conclusion = String(runInfo.conclusion || runInfo.status || "");
  const status: HealthStatus = conclusion === "success" ? "healthy" : ["failure", "cancelled", "timed_out"].includes(conclusion) ? "error" : "warning";
  return { configured: true, status, conclusion, updatedAt: String(runInfo.updated_at || runInfo.created_at || "") };
}

export async function collectRepoStatus() {
  const data = await githubApi("");
  const configured = Boolean(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);
  if (!data) return { configured, status: "unknown" as HealthStatus, active: null as boolean | null };
  return { configured: true, status: "healthy" as HealthStatus, active: !data.archived, isPrivate: Boolean(data.private) };
}

export async function collectCpu() {
  const cores = os.cpus()?.length || 1;
  const load1 = os.loadavg()?.[0] ?? 0;
  const usage = pct(load1, cores);
  return { usage, cores, status: byUsage(usage) };
}

export function collectMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usage = pct(used, total);
  return { usage, usedText: fmtBytes(used), totalText: fmtBytes(total), status: byUsage(usage) };
}

export async function collectDisk() {
  const out = await run("df -kP / 2>/dev/null | tail -1");
  if (!out) return { usage: 0, usedText: "—", totalText: "—", status: "unknown" as HealthStatus };
  const parts = out.split(/\s+/);
  const totalKb = Number(parts[1] || 0);
  const usedKb = Number(parts[2] || 0);
  const usage = pct(usedKb, totalKb);
  return { usage, usedText: fmtBytes(usedKb * 1024), totalText: fmtBytes(totalKb * 1024), status: byUsage(usage, 80, 92) };
}

export async function collectPm2() {
  const out = await run("pm2 jlist 2>/dev/null");
  if (!out) return { installed: false, processes: [] as any[], status: "unknown" as HealthStatus, onlineText: "" };
  try {
    const list = JSON.parse(out);
    const processes = (Array.isArray(list) ? list : []).map((p: any) => ({
      name: String(p.name || "app"),
      status: String(p.pm2_env?.status || "unknown"),
      cpu: Number(p.monit?.cpu || 0),
      memory: fmtBytes(Number(p.monit?.memory || 0)),
      restarts: Number(p.pm2_env?.restart_time || 0),
      uptime: p.pm2_env?.pm_uptime ? fmtDuration((Date.now() - Number(p.pm2_env.pm_uptime)) / 1000) : "—"
    }));
    const anyStopped = processes.some((p) => p.status !== "online");
    const online = processes.filter((p) => p.status === "online").length;
    return {
      installed: true,
      processes,
      status: (processes.length === 0 ? "warning" : anyStopped ? "error" : "healthy") as HealthStatus,
      onlineText: processes.length ? `${online}/${processes.length}` : ""
    };
  } catch {
    return { installed: true, processes: [], status: "warning" as HealthStatus, onlineText: "" };
  }
}

export async function collectRuntime() {
  const npm = (await run("npm -v")) || "—";
  return { node: process.version, npm };
}

export async function collectDatabase() {
  const started = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    const responseMs = Date.now() - started;
    let connections = 0;
    try {
      const rows: any = await db.execute(sql`SELECT count(*)::int AS c FROM pg_stat_activity`);
      const arr = Array.isArray(rows) ? rows : rows?.rows || [];
      connections = Number(arr?.[0]?.c ?? 0);
    } catch {
      connections = 0;
    }
    return { online: true, status: (responseMs > 1500 ? "warning" : "healthy") as HealthStatus, responseMs, connections };
  } catch {
    return { online: false, status: "error" as HealthStatus, responseMs: -1, connections: 0 };
  }
}

export async function collectActiveUsers(): Promise<number> {
  for (const stmt of [
    sql`SELECT count(DISTINCT actor_id)::int AS c FROM erp_multilingual_events WHERE created_at > now() - interval '15 minutes'`,
    sql`SELECT count(DISTINCT user_id)::int AS c FROM audit_logs WHERE created_at > now() - interval '15 minutes'`
  ]) {
    try {
      const rows: any = await db.execute(stmt);
      const arr = Array.isArray(rows) ? rows : rows?.rows || [];
      return Number(arr?.[0]?.c ?? 0);
    } catch {
      /* try next */
    }
  }
  return 0;
}

function monitorDomain(): string {
  const raw = process.env.MONITOR_DOMAIN || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
}

export async function collectSsl(): Promise<{ configured: boolean; status: HealthStatus; daysLeft: number | null }> {
  const host = monitorDomain();
  if (!host) return { configured: false, status: "unknown", daysLeft: null };
  return await new Promise((resolve) => {
    let settled = false;
    const done = (v: any) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      const socket = tls.connect({ host, port: 443, servername: host, timeout: 6000 }, () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) return done({ configured: true, status: "warning", daysLeft: null });
        const daysLeft = Math.round((new Date(cert.valid_to).getTime() - Date.now()) / 86400000);
        const status: HealthStatus = daysLeft <= 0 ? "error" : daysLeft <= 14 ? "warning" : "healthy";
        done({ configured: true, status, daysLeft });
      });
      socket.on("error", () => done({ configured: true, status: "error", daysLeft: null }));
      socket.on("timeout", () => {
        socket.destroy();
        done({ configured: true, status: "warning", daysLeft: null });
      });
    } catch {
      done({ configured: true, status: "error", daysLeft: null });
    }
  });
}

export async function collectDomain(): Promise<{ configured: boolean; status: HealthStatus; httpStatus: number | null }> {
  const host = monitorDomain();
  if (!host) return { configured: false, status: "unknown", httpStatus: null };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://${host}`, { method: "HEAD", signal: controller.signal, redirect: "manual" as RequestRedirect });
    clearTimeout(timer);
    return { configured: true, status: (res.status < 500 ? "healthy" : "error") as HealthStatus, httpStatus: res.status };
  } catch {
    return { configured: true, status: "error", httpStatus: null };
  }
}

function projectRoot(): string {
  return process.cwd();
}

export function collectBackups(): { status: HealthStatus; latestIso: string | null } {
  try {
    const dir = path.join(projectRoot(), "backups");
    if (!fs.existsSync(dir)) return { status: "warning", latestIso: null };
    const files = fs
      .readdirSync(dir)
      .map((f) => {
        try {
          return { f, m: fs.statSync(path.join(dir, f)).mtimeMs };
        } catch {
          return { f, m: 0 };
        }
      })
      .filter((x) => x.m > 0)
      .sort((a, b) => b.m - a.m);
    if (files.length === 0) return { status: "warning", latestIso: null };
    const ageDays = (Date.now() - files[0].m) / 86400000;
    return { status: (ageDays > 7 ? "warning" : "healthy") as HealthStatus, latestIso: new Date(files[0].m).toISOString() };
  } catch {
    return { status: "unknown", latestIso: null };
  }
}

function tailCount(file: string, pattern: RegExp): number {
  try {
    const full = path.join(projectRoot(), file);
    if (!fs.existsSync(full)) return 0;
    const size = fs.statSync(full).size;
    const readBytes = Math.min(size, 512 * 1024);
    const fd = fs.openSync(full, "r");
    const buf = Buffer.alloc(readBytes);
    fs.readSync(fd, buf, 0, readBytes, size - readBytes);
    fs.closeSync(fd);
    return (buf.toString("utf8").match(pattern) || []).length;
  } catch {
    return 0;
  }
}

export function collectLogs() {
  const errorCount = tailCount("api-error-log.txt", /\berror\b/gi) + tailCount("error_log.txt", /\berror\b/gi);
  const warnCount = tailCount("api-error-log.txt", /\bwarn(ing)?\b/gi) + tailCount("error_log.txt", /\bwarn(ing)?\b/gi);
  return {
    errorCount,
    warnCount,
    errorStatus: (errorCount > 50 ? "error" : errorCount > 0 ? "warning" : "healthy") as HealthStatus,
    warnStatus: (warnCount > 100 ? "warning" : "healthy") as HealthStatus
  };
}

export function collectBuildVersion() {
  let version = "0.0.0";
  try {
    version = JSON.parse(fs.readFileSync(path.join(projectRoot(), "package.json"), "utf8")).version || version;
  } catch {
    /* ignore */
  }
  return { version, buildId: process.env.BUILD_ID || process.env.NEXT_PUBLIC_BUILD_ID || "" };
}
