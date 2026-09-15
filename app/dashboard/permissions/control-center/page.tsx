import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { PermissionControlCenterView } from "@/features/permissions/components/permission-control-center-view";

export const metadata: Metadata = {
  title: "Permission Control Center | Super Admin",
  description: "Super Admin only hierarchy view of Country / Main Branch / City Branch / User rules and effective permissions."
};

export const dynamic = "force-dynamic";

export default async function PermissionControlCenterPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");
  if (!session.isSuperAdmin) redirect("/dashboard");

  return <PermissionControlCenterView isSuperAdmin={session.isSuperAdmin} />;
}
