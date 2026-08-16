import type { Metadata } from "next";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { dashboardByRole } from "@/lib/permissions/enterprise-roles";
import { AdminUserManagementPanel } from "@/features/users/components/admin-user-management-panel";

export const metadata: Metadata = {
  title: "User Login Management | Super Admin",
  description: "Super Admin only login-management page for branch-scoped ERP users."
};

export default async function UsersPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");
  if (!session.isSuperAdmin) {
    const role = session.roles?.[0];
    const target = role ? dashboardByRole[role] : "/dashboard";
    redirect((target || "/dashboard") as Route);
  }

  return <AdminUserManagementPanel />;
}
