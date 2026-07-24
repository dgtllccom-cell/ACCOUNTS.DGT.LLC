/**
 * Server & Project Monitoring — status aggregator.
 * Runs every collector in parallel and shapes the result for the dashboard table.
 */
import {
  collectGit,
  collectGitHubActions,
  collectRepoStatus,
  collectCpu,
  collectMemory,
  collectDisk,
  collectPm2,
  collectRuntime,
  collectDatabase,
  collectActiveUsers,
  collectSsl,
  collectDomain,
  collectBackups,
  collectLogs,
  collectBuildVersion,
  type HealthStatus,
  type Metric
} from "@/lib/monitoring/collectors";

export type MonitorStatus = {
  generatedAt: string;
  overall: HealthStatus;
  metrics: Metric[];
  pm2Processes: any[];
  raw: Record<string, any>;
};

function worstOf(list: HealthStatus[]): HealthStatus {
  if (list.includes("error")) return "error";
  if (list.includes("warning")) return "warning";
  if (list.some((s) => s === "healthy")) return "healthy";
  return "unknown";
}

export async function getMonitorStatus(): Promise<MonitorStatus> {
  const [git, actions, repo, cpu, mem, disk, pm2, runtime, dbStatus, activeUsers, ssl, domain, backups, logs, build] =
    await Promise.all([
      collectGit(),
      collectGitHubActions(),
      collectRepoStatus(),
      collectCpu(),
      Promise.resolve(collectMemory()),
      collectDisk(),
      collectPm2(),
      collectRuntime(),
      collectDatabase(),
      collectActiveUsers(),
      collectSsl() as Promise<any>,
      collectDomain(),
      Promise.resolve(collectBackups()),
      Promise.resolve(collectLogs()),
      Promise.resolve(collectBuildVersion())
    ]);

  const metrics: Metric[] = [
    // --- Source control & CI/CD ---
    { group: "Source Control & CI/CD", key: "repo", label: "GitHub Repository", value: repo.text, status: repo.status },
    { group: "Source Control & CI/CD", key: "branch", label: "Current Branch", value: git.branch, status: "healthy" },
    { group: "Source Control & CI/CD", key: "commit", label: "Latest Commit ID", value: git.commitShort, status: "healthy", hint: git.lastMessage },
    { group: "Source Control & CI/CD", key: "gh_actions", label: "GitHub Actions", value: actions.text, status: actions.status },
    { group: "Source Control & CI/CD", key: "deploy", label: "Last Deployment", value: actions.text || "—", status: actions.status },
    { group: "Source Control & CI/CD", key: "updated_by", label: "Last Updated By", value: git.lastAuthor, status: "healthy", hint: git.lastDate },
    { group: "Source Control & CI/CD", key: "build", label: "Build Version", value: build.buildId ? `${build.version} (${build.buildId.slice(0, 7)})` : build.version, status: "healthy" },

    // --- Server / VPS ---
    { group: "Server / VPS", key: "vps", label: "VPS Server", value: `Online · ${os_hostname()}`, status: "healthy" },
    { group: "Server / VPS", key: "cpu", label: "CPU Usage", value: `${cpu.usage}% · ${cpu.cores} cores`, status: cpu.status },
    { group: "Server / VPS", key: "ram", label: "RAM Usage", value: `${mem.usage}% · ${mem.usedText}/${mem.totalText}`, status: mem.status },
    { group: "Server / VPS", key: "disk", label: "Disk Usage", value: disk.usage ? `${disk.usage}% · ${disk.usedText}/${disk.totalText}` : disk.totalText, status: disk.status },
    { group: "Server / VPS", key: "pm2", label: "PM2 Process", value: pm2.text, status: pm2.status },
    { group: "Server / VPS", key: "uptime", label: "System Uptime", value: fmtDuration(process.uptime()), status: "healthy", hint: `host up ${fmtDuration(osUptime())}` },
    { group: "Server / VPS", key: "node", label: "Node.js Version", value: runtime.node, status: "healthy" },
    { group: "Server / VPS", key: "npm", label: "NPM Version", value: runtime.npm, status: "healthy" },

    // --- Database & API ---
    { group: "Database & API", key: "db", label: "Database (Supabase)", value: dbStatus.online ? "Online" : "Offline", status: dbStatus.status },
    { group: "Database & API", key: "api", label: "API Health", value: dbStatus.online ? "Healthy" : "Degraded", status: dbStatus.online ? "healthy" : "error" },
    { group: "Database & API", key: "resp", label: "Response Time", value: dbStatus.responseMs >= 0 ? `${dbStatus.responseMs} ms` : "—", status: dbStatus.responseMs >= 0 && dbStatus.responseMs < 800 ? "healthy" : dbStatus.responseMs < 0 ? "error" : "warning" },
    { group: "Database & API", key: "db_conn", label: "Database Connections", value: String(dbStatus.connections), status: dbStatus.connections > 90 ? "warning" : "healthy" },
    { group: "Database & API", key: "active_users", label: "Active Users (15m)", value: String(activeUsers), status: "healthy" },

    // --- Network & security ---
    { group: "Network & Security", key: "domain", label: "Domain Status", value: domain.text, status: domain.status },
    { group: "Network & Security", key: "ssl", label: "SSL Certificate", value: ssl.text, status: ssl.status },

    // --- Operations ---
    { group: "Operations", key: "backup", label: "Last Backup", value: backups.text, status: backups.status },
    { group: "Operations", key: "errors", label: "Error Logs (recent)", value: String(logs.errorCount), status: logs.errorStatus },
    { group: "Operations", key: "warnings", label: "Warning Logs (recent)", value: String(logs.warnCount), status: logs.warnStatus }
  ];

  const overall = worstOf(metrics.map((m) => m.status));

  return {
    generatedAt: new Date().toISOString(),
    overall,
    metrics,
    pm2Processes: pm2.processes || [],
    raw: { git, actions, repo, cpu, mem, disk, pm2, runtime, dbStatus, activeUsers, ssl, domain, backups, logs, build }
  };
}

/* small local helpers kept here to avoid importing os twice into the route bundle */
import os from "node:os";
function os_hostname(): string {
  try {
    return os.hostname();
  } catch {
    return "server";
  }
}
function osUptime(): number {
  try {
    return os.uptime();
  } catch {
    return 0;
  }
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
