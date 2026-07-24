import { getCurrentErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { getLanguageDirection } from "@/lib/i18n/languages";
import { ServerMonitoringDashboard } from "@/features/monitoring/components/server-monitoring-dashboard";

export const dynamic = "force-dynamic";

function githubSlug(): string {
  const explicit = process.env.GITHUB_REPO;
  if (explicit) return explicit;
  const url = process.env.GITHUB_REPO_URL || "";
  const m = url.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?/i);
  return m ? m[1] : "dgtllccom-cell/ACCOUNTS.DGT.LLC";
}

function supabaseDashboardUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? `https://supabase.com/dashboard/project/${m[1]}` : "https://supabase.com/dashboard/projects";
}

export default async function MonitoringPage() {
  const [session, lang] = await Promise.all([getCurrentErpSession(), getRequestLanguage()]);
  const dir = getLanguageDirection(lang);
  const slug = githubSlug();

  return (
    <ServerMonitoringDashboard
      lang={lang}
      dir={dir}
      isSuperAdmin={Boolean(session?.isSuperAdmin)}
      githubUrl={`https://github.com/${slug}`}
      githubActionsUrl={`https://github.com/${slug}/actions`}
      supabaseUrl={supabaseDashboardUrl()}
    />
  );
}
