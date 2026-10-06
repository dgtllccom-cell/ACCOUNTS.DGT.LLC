import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { PasswordChangeForm } from "@/features/settings/components/password-change-form";

export const metadata = { title: "Settings — Super Admin Security" };

export const dynamic = "force-dynamic";

export default async function SuperAdminSecurityPage() {
  const session = await requireErpSession();
  const lang = await getRequestLanguage();

  if (!session.isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-red-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-red-600 mb-2">
          {t(lang, "admin_sec.forbidden", "Access Denied")}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {t(lang, "admin_sec.super_admin_only", "This section is only available to Super Admin users")}
        </p>
      </div>
    );
  }

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-blue-600" />
          {t(lang, "admin_sec.title", "Super Admin Security")}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {t(lang, "admin_sec.subtitle", "Manage your Super Admin account security settings")}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
        <PasswordChangeForm />
      </div>
    </main>
  );
}
