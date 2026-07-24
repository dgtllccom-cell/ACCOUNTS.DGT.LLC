import { getCurrentErpSession } from "@/lib/auth/session";
import { ServerMonitoringDashboard } from "@/features/monitoring/components/server-monitoring-dashboard";

export const dynamic = "force-dynamic";

function githubSlug(): string {
  const explicit = process.env.GITHUB_REPO;
  if (explicit) return explicit;
  const url = process.env.GITHUB_REPO_URL || "";
  const m = url.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?/i);
  if (m) return m[1];
  return "dgtllccom-cell/ACCOUNTS.DGT.LLC";
}

function supabaseDashboardUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (m) return `https://supabase.com/dashboard/project/${m[1]}`;
  return "https://supabase.com/dashboard/projects";
}

export default async function MonitoringPage() {
  const session = await getCurrentErpSession();
  const slug = githubSlug();

  return (
    <ServerMonitoringDashboard
      isSuperAdmin={Boolean(session?.isSuperAdmin)}
      githubUrl={`https://github.com/${slug}`}
      githubActionsUrl={`https://github.com/${slug}/actions`}
      supabaseUrl={supabaseDashboardUrl()}
    />
  );
}
