import { Suspense } from "react";
import { UserRegistrationWizard } from "@/features/users/components/user-registration-wizard";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UserEditRoute({ params }: Props) {
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

