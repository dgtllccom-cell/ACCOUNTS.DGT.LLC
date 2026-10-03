import { redirect } from "next/navigation";
import type { Route } from "next";
import { getCurrentErpSession } from "@/lib/auth/session";
import { dashboardForRoles } from "@/lib/permissions/enterprise-roles";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * /dashboard is only a ROUTER: it sends every login to the dashboard that matches its effective role and scope.
 * It deliberately renders no data of its own — a landing page that read the whole database with the service role would show
 * global totals to a scoped user (the previous behaviour for any role without an explicit mapping).
 */
export default async function DashboardPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login" as Route);
  const target = dashboardForRoles(session.roles, { isSuperAdmin: session.isSuperAdmin, isShippingScoped: session.isShippingScoped });
  redirect(target as Route);
}
