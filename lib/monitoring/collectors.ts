/**
 * Server & Project Monitoring — data collectors.
 *
 * All functions run on the server (Node runtime) and are individually guarded so a
 * single failing probe never breaks the whole dashboard. Each metric returns a value
 * plus a `status` used by the UI to colour it: healthy | warning | error | unknown.
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

export type Metric = {
  key: string;
  label: string;
  value: string;
  status: HealthStatus;
  hint?: string;
  group: string;
};

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

function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* --------------------------------- Git / GitHub --------------------------------- */

function repoSlug(remote: string): string {
  const m = remote.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?/i);
  return m ? m[1] : "";
}

export async function collectGit() {
  const branch = (await run("git rev-parse --abbrev-ref HEAD")) || process.env.VERCEL_GIT_COMMIT_REF || "unknown";
  const commitFull = (await run("git rev-parse HEAD")) || process.env.VERCEL_GIT_COMMIT_SHA || "";
  const commitShort = commitFull ? commitFull.slice(0, 7) : "unknown";
  const lastMsg = await run('git log -1 --pretty=%s');
  const lastAuthor = (await run('git log -1 --pretty=%an')) || "unknown";
  const lastDate = await run('git log -1 --pretty=%cI');
  const porcelain = await run("git status --porcelain");
  const remote = (await run("git remote get-url origin")) || process.env.GITHUB_REPO_URL || "";
  const slug = process.env.GITHUB_REPO || repoSlug(remote);
  return {
    branch,
    commitShort,
    commitFull,
    lastMessage: lastMsg,
    lastAuthor,
    lastDate,
    dirty: Boolean(porcelain),
    slug,
    remote
  };
}

async function githubApi(pathname: string): Promise<any | null> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const slug = process.env.GITHUB_REPO || repoSlug(process.env.GITHUB_REPO_URL || "");
  if (!token || !slug) return null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://api.github.com/repos/${slug}${pathname}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "dgt-erp-monitor"
      },
      signal: controller.signal
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function collectGitHubActions() {
  const data = await githubApi("/actions/runs?per_page=1");
  if (!data || !Array.isArray(data.workflow_runs) || data.workflow_runs.length === 0) {
    return { configured: Boolean(process.env.GITHUB_TOKEN), status: "unknown" as HealthStatus, text: process.env.GITHUB_TOKEN ? "No runs found" : "Not configured", conclusion: "", updatedAt: "" };
  }
  const runInfo = data.workflow_runs[0];
  const conclusion = String(runInfo.conclusion || runInfo.status || "");
  const status: HealthStatus = conclusion === "success" ? "healthy" : conclusion === "failure" || conclusion === "cancelled" || conclusion === "timed_out" ? "error" : "warning";
  return {
    configured: true,
    status,
    text: conclusion || "in progress",
    conclusion,
    updatedAt: String(runInfo.updated_at || runInfo.created_at || ""),
    url: String(runInfo.html_url || "")
  };
}

export async function collectRepoStatus() {
  const data = await githubApi("");
  if (!data) return { configured: Boolean(process.env.GITHUB_TOKEN), status: "unknown" as HealthStatus, text: process.env.GITHUB_TOKEN ? "Unavailable" : "Not configured", isPrivate: null as boolean | null };
  return {
    configured: true,
    status: "healthy" as HealthStatus,
    text: data.archived ? "Archived" : "Active",
    isPrivate: Boolean(data.private),
    defaultBranch: String(data.default_branch || ""),
    openIssues: Number(data.open_issues_count || 0)
  };
}

/* ----------------------------------- System ----------------------------------- */

export async function collectCpu() {
  const cores = os.cpus()?.length || 1;
  const load1 = os.loadavg()?.[0] ?? 0;
  const usage = pct(load1, cores);
  return { usage, cores, load1: Number(load1.toFixed(2)), status: byUsage(usage) };
}

export function collectMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usage = pct(used, total);
  return { usage, usedText: fmtBytes(used), totalText: fmtBytes(total), status: byUsage(usage) };
}

export async function collectDisk() {
  // Linux/macOS df; on Windows this simply returns unknown.
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
  if (!out) return { installed: false, processes: [] as any[], status: "unknown" as HealthStatus, text: "PM2 not detected" };
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
    return {
      installed: true,
      processes,
      status: (processes.length === 0 ? "warning" : anyStopped ? "error" : "healthy") as HealthStatus,
      text: processes.length ? `${processes.filter((p) => p.status === "online").length}/${processes.length} online` : "No processes"
    };
  } catch {
    return { installed: true, processes: [], status: "warning" as HealthStatus, text: "Unable to parse PM2" };
  }
}

export async function collectRuntime() {
  const npm = (await run("npm -v")) || "unknown";
  return { node: process.version, npm };
}

/* --------------------------------- Database ---------------------------------- */

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
    const status: HealthStatus = responseMs > 1500 ? "warning" : "healthy";
    return { online: true, status, responseMs, connections };
  } catch {
    return { online: false, status: "error" as HealthStatus, responseMs: -1, connections: 0 };
  }
}

export async function collectActiveUsers(): Promise<number> {
  // Best-effort: distinct actors in audit_logs within the last 15 minutes.
  for (const stmt of [
    sql`SELECT count(DISTINCT user_id)::int AS c FROM audit_logs WHERE created_at > now() - interval '15 minutes'`,
    sql`SELECT count(DISTINCT actor_id)::int AS c FROM audit_events WHERE created_at > now() - interval '15 minutes'`
  ]) {
    try {
      const rows: any = await db.execute(stmt);
      const arr = Array.isArray(rows) ? rows : rows?.rows || [];
      return Number(arr?.[0]?.c ?? 0);
    } catch {
      // try next candidate table
    }
  }
  return 0;
}

/* --------------------------------- Network ----------------------------------- */

function monitorDomain(): string {
  const raw =
    process.env.MONITOR_DOMAIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
}

export async function collectSsl() {
  const host = monitorDomain();
  if (!host) return { configured: false, status: "unknown" as HealthStatus, text: "Domain not set", daysLeft: null as number | null };
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
        if (!cert || !cert.valid_to) return done({ configured: true, status: "warning", text: "No certificate", daysLeft: null });
        const daysLeft = Math.round((new Date(cert.valid_to).getTime() - Date.now()) / 86400000);
        const status: HealthStatus = daysLeft <= 0 ? "error" : daysLeft <= 14 ? "warning" : "healthy";
        done({ configured: true, status, text: daysLeft <= 0 ? "Expired" : `${daysLeft} days left`, daysLeft, validTo: cert.valid_to });
      });
      socket.on("error", () => done({ configured: true, status: "error", text: "Handshake failed", daysLeft: null }));
      socket.on("timeout", () => {
        socket.destroy();
        done({ configured: true, status: "warning", text: "Timed out", daysLeft: null });
      });
    } catch {
      done({ configured: true, status: "error", text: "TLS error", daysLeft: null });
    }
  });
}

export async function collectDomain() {
  const host = monitorDomain();
  if (!host) return { configured: false, status: "unknown" as HealthStatus, text: "Domain not set" };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const started = Date.now();
    const res = await fetch(`https://${host}`, { method: "HEAD", signal: controller.signal, redirect: "manual" as RequestRedirect });
    clearTimeout(t);
    const ms = Date.now() - started;
    const ok = res.status < 500;
    return { configured: true, status: (ok ? "healthy" : "error") as HealthStatus, text: `HTTP ${res.status}`, responseMs: ms };
  } catch {
    return { configured: true, status: "error" as HealthStatus, text: "Unreachable" };
  }
}

/* ------------------------------- Files / logs -------------------------------- */

function projectRoot(): string {
  return process.cwd();
}

export function collectBackups() {
  try {
    const dir = path.join(projectRoot(), "backups");
    if (!fs.existsSync(dir)) return { status: "warning" as HealthStatus, text: "No backups folder", latest: null as string | null };
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
    if (files.length === 0) return { status: "warning" as HealthStatus, text: "No backups yet", latest: null };
    const ageDays = (Date.now() - files[0].m) / 86400000;
    const status: HealthStatus = ageDays > 7 ? "warning" : "healthy";
    return { status, text: new Date(files[0].m).toISOString(), latest: files[0].f, ageDays: Math.round(ageDays) };
  } catch {
    return { status: "unknown" as HealthStatus, text: "Unavailable", latest: null };
  }
}

function tailCount(file: string, patterns: RegExp): number {
  try {
    const full = path.join(projectRoot(), file);
    if (!fs.existsSync(full)) return 0;
    const stat = fs.statSync(full);
    const size = stat.size;
    const readBytes = Math.min(size, 512 * 1024);
    const fd = fs.openSync(full, "r");
    const buf = Buffer.alloc(readBytes);
    fs.readSync(fd, buf, 0, readBytes, size - readBytes);
    fs.closeSync(fd);
    const text = buf.toString("utf8");
    return (text.match(patterns) || []).length;
  } catch {
    return 0;
  }
}

export function collectLogs() {
  const errorCount =
    tailCount("api-error-log.txt", /\berror\b/gi) + tailCount("error_log.txt", /\berror\b/gi);
  const warnCount =
    tailCount("api-error-log.txt", /\bwarn(ing)?\b/gi) + tailCount("error_log.txt", /\bwarn(ing)?\b/gi);
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
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot(), "package.json"), "utf8"));
    version = pkg.version || version;
  } catch {
    /* ignore */
  }
  const buildId = process.env.BUILD_ID || process.env.NEXT_PUBLIC_BUILD_ID || "";
  return { version, buildId };
}
