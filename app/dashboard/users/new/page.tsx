import { Suspense } from "react";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { dashboardByRole } from "@/lib/permissions/enterprise-roles";
import { UserRegistrationWizard } from "@/features/users/components/user-registration-wizard";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export default async function NewUserRegistrationPage() {
  const session = await getCurrentErpSession();
  if (!session) redirect("/auth/login");

  const isCountryManager = session.roles?.some((r) => r === "country_admin" || r === "main_branch_admin");
  if (!session.isSuperAdmin && !isCountryManager) {
    const role = session.roles?.[0];
    const target = role ? dashboardByRole[role] : "/dashboard";
    redirect((target || "/dashboard") as Route);
  }

  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">{t(lang, "common.loading_user_reg_form", "Loading User Registration Form...")}</div>}>
      <UserRegistrationWizard />
    </Suspense>
  );
}

export function generateMetadata() {
  return {
    title: "User Registration Form | System User Setup",
    description: "Create and register a new system user record in the ERP system",
  };
}
