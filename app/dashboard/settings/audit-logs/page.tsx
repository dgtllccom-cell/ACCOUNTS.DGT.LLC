import { redirect } from "next/navigation";

export const metadata = { title: "Audit Logs" };

// Audit logs are surfaced by the Enterprise Audit Monitoring dashboard
// (edit history, deleted records, daily activity, user activity).
export default function SettingsAuditLogsPage() {
  redirect("/dashboard/audit-monitoring" as any);
}
