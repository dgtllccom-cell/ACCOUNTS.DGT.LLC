import { Suspense } from "react";
import { UserRegistrationWizard } from "@/features/users/components/user-registration-wizard";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export default async function NewUserRegistrationPage() {
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
