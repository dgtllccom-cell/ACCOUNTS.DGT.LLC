import { redirect } from "next/navigation";

export const metadata = { title: "Security Events" };

// Security-relevant events (sign-ins, permission changes, deletions) are
// tracked in the Enterprise Audit Monitoring dashboard.
export default function SettingsSecurityEventsPage() {
  redirect("/dashboard/audit-monitoring" as any);
}
