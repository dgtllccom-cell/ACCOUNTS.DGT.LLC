/**
 * Server & Project Monitoring — status aggregator.
 * Returns metrics carrying translation KEYS (labelKey / optional valueKey) plus
 * technical values; the client renders them in the user's language. Runs all probes
 * in parallel.
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
  fmtDuration,
  type HealthStatus
} from "@/lib/monitoring/collectors";
import os from "node:os";

export type MetricDto = {
  key: string;
  group: string;
  labelKey: string;
  status: HealthStatus;
  value?: string;
  valueKey?: string;
  valueParams?: Record<string, string | number>;
  hint?: string;
};

export type MonitorStatusDto = {
  generatedAt: string;
  overall: HealthStatus;
  metrics: MetricDto[];
  pm2Processes: any[];
};

function worstOf(list: HealthStatus[]): HealthStatus {
  if (list.includes("error")) return "error";
  if (list.includes("warning")) return "warning";
  if (list.some((s) => s === "healthy")) return "healthy";
  return "unknown";
}

function hostname(): string {
  try {
    return os.hostname();
  } catch {
    return "server";
  }
}

export async function getMonitorStatus(): Promise<MonitorStatusDto> {
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
      collectSsl(),
      collectDomain(),
      Promise.resolve(collectBackups()),
      Promise.resolve(collectLogs()),
      Promise.resolve(collectBuildVersion())
    ]);

  const actionsValueKey = actions.status === "healthy" ? "v.healthy" : actions.status === "error" ? "status.error" : actions.configured ? "status.warning" : "v.notConfigured";

  const metrics: MetricDto[] = [
    { group: "group.source", key: "repo", labelKey: "m.repo", status: repo.status, valueKey: repo.active === false ? "status.warning" : repo.configured ? "v.active" : "v.notConfigured" },
    { group: "group.source", key: "branch", labelKey: "m.branch", status: "healthy", value: git.branch },
    { group: "group.source", key: "commit", labelKey: "m.commit", status: "healthy", value: git.commitShort, hint: git.lastMessage },
    { group: "group.source", key: "actions", labelKey: "m.actions", status: actions.status, valueKey: actionsValueKey, value: actions.conclusion || undefined },
    { group: "group.source", key: "deploy", labelKey: "m.deploy", status: actions.status, valueKey: actionsValueKey, value: actions.conclusion || undefined },
    { group: "group.source", key: "updatedBy", labelKey: "m.updatedBy", status: "healthy", value: git.lastAuthor, hint: git.lastDate },
    { group: "group.source", key: "build", labelKey: "m.build", status: "healthy", value: build.buildId ? `${build.version} (${build.buildId.slice(0, 7)})` : build.version },

    { group: "group.server", key: "vps", labelKey: "m.vps", status: "healthy", valueKey: "v.online", value: hostname() },
    { group: "group.server", key: "cpu", labelKey: "m.cpu", status: cpu.status, value: `${cpu.usage}% (${cpu.cores})` },
    { group: "group.server", key: "ram", labelKey: "m.ram", status: mem.status, value: `${mem.usage}% · ${mem.usedText}/${mem.totalText}` },
    { group: "group.server", key: "disk", labelKey: "m.disk", status: disk.status, value: disk.usage ? `${disk.usage}% · ${disk.usedText}/${disk.totalText}` : disk.totalText },
    { group: "group.server", key: "pm2", labelKey: "m.pm2", status: pm2.status, value: pm2.onlineText || undefined, valueKey: pm2.onlineText ? undefined : "v.none" },
    { group: "group.server", key: "uptime", labelKey: "m.uptime", status: "healthy", value: fmtDuration(process.uptime()) },
    { group: "group.server", key: "node", labelKey: "m.node", status: "healthy", value: runtime.node },
    { group: "group.server", key: "npm", labelKey: "m.npm", status: "healthy", value: runtime.npm },

    { group: "group.database", key: "db", labelKey: "m.db", status: dbStatus.status, valueKey: dbStatus.online ? "v.online" : "v.offline" },
    { group: "group.database", key: "api", labelKey: "m.api", status: dbStatus.online ? "healthy" : "error", valueKey: dbStatus.online ? "v.healthy" : "v.degraded" },
    { group: "group.database", key: "resp", labelKey: "m.resp", status: dbStatus.responseMs >= 0 && dbStatus.responseMs < 800 ? "healthy" : dbStatus.responseMs < 0 ? "error" : "warning", value: dbStatus.responseMs >= 0 ? `${dbStatus.responseMs} ms` : "—" },
    { group: "group.database", key: "dbConn", labelKey: "m.dbConn", status: dbStatus.connections > 90 ? "warning" : "healthy", value: String(dbStatus.connections) },
    { group: "group.database", key: "activeUsers", labelKey: "m.activeUsers", status: "healthy", value: String(activeUsers) },

    { group: "group.network", key: "domain", labelKey: "m.domain", status: domain.status, value: domain.httpStatus ? `HTTP ${domain.httpStatus}` : undefined, valueKey: domain.configured ? undefined : "v.notConfigured" },
    { group: "group.network", key: "ssl", labelKey: "m.ssl", status: ssl.status, valueKey: !ssl.configured ? "v.notConfigured" : ssl.daysLeft === null ? "status.warning" : ssl.daysLeft <= 0 ? "v.expired" : "v.daysLeft", valueParams: ssl.daysLeft && ssl.daysLeft > 0 ? { n: ssl.daysLeft } : undefined },

    { group: "group.operations", key: "backup", labelKey: "m.backup", status: backups.status, value: backups.latestIso || undefined, valueKey: backups.latestIso ? undefined : "v.none" },
    { group: "group.operations", key: "errors", labelKey: "m.errors", status: logs.errorStatus, value: String(logs.errorCount) },
    { group: "group.operations", key: "warnings", labelKey: "m.warnings", status: logs.warnStatus, value: String(logs.warnCount) }
  ];

  return {
    generatedAt: new Date().toISOString(),
    overall: worstOf(metrics.map((m) => m.status)),
    metrics,
    pm2Processes: pm2.processes || []
  };
}
