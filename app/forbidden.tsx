import Link from "next/link";
import { Home, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { getLanguageDirection } from "@/lib/i18n/languages";

/** Rendered (HTTP 403) when the access policy refuses a /dashboard route — see app/dashboard/layout.tsx. */
export default async function Forbidden() {
  const lang = await getRequestLanguage();
  return (
    <div dir={getLanguageDirection(lang)} className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-white" data-testid="access-denied">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black tracking-tight">{t(lang, "rbac.denied_title", "403 - Access denied")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t(lang, "rbac.denied_body", "Your role, country, branch or assignment does not allow you to open this page. Nothing was loaded.")}
        </p>
        <div className="pt-2">
          <Button asChild className="gap-2 bg-blue-600 font-bold hover:bg-blue-500">
            <Link href="/dashboard">
              <Home className="h-4 w-4" /> {t(lang, "rbac.denied_home", "Go to my dashboard")}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
