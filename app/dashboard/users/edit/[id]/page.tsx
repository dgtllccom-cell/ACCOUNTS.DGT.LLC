import { Suspense } from "react";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { dashboardByRole } from "@/lib/permissions/enterprise-roles";
import { UserRegistrationWizard } from "@/features/users/components/user-registration-wizard";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UserEditRoute({ params }: Props) {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");

  const isCountryManager = session.roles?.some((r) => r === "country_admin" || r === "main_branch_admin");
  if (!session.isSuperAdmin && !isCountryManager) {
    const role = session.roles?.[0];
    const target = role ? dashboardByRole[role] : "/dashboard";
    redirect((target || "/dashboard") as Route);
  }

  const { id } = await params;
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">{t(lang, "common.loading_wizard", "Loading Wizard...")}</div>}>
      <UserRegistrationWizard userIdProp={id} />
    </Suspense>
  );
}

export function generateMetadata() {
  return {
    title: "Edit User | ERP",
    description: "Edit user profile, branch, permissions and security settings",
  };
}

