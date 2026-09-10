import { redirect } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { updateOwnPassword } from "@/features/auth/actions";
import { getCurrentErpSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";

export const metadata = { title: "Auth — Set New Password" };

export default async function SetNewPasswordPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const lang = await getRequestLanguage();

  // Must already be authenticated (this page follows a real login with the
  // temporary password) - never a public password-set form.
  const session = await getCurrentErpSession();
  if (!session) {
    redirect("/auth/login");
  }

  return (
    <main className="min-h-screen bg-[#160a3a] text-white">
      <div className="mx-auto flex min-h-screen max-w-[900px] items-center px-5 py-10">
        <div className="w-full rounded-[28px] border border-white/10 bg-white/95 p-7 text-slate-950 shadow-2xl shadow-black/25 dark:bg-slate-950/60 dark:text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{t(lang, "snp.title", "Set a New Password")}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-200">
                {t(lang, "snp.subtitle", "Your account was reset with a temporary password. Please create your own private password to continue.")}
              </p>
            </div>
          </div>

          {params.error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
              {decodeURIComponent(params.error)}
            </div>
          ) : null}

          <form action={updateOwnPassword} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t(lang, "snp.new_password", "New Password")}
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 shadow-none focus-visible:ring-primary"
                  placeholder={t(lang, "snp.new_password_ph", "Enter a new password (min 8 characters)")}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {t(lang, "snp.confirm_password", "Confirm New Password")}
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" aria-hidden />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 shadow-none focus-visible:ring-primary"
                  placeholder={t(lang, "snp.confirm_password_ph", "Re-enter the new password")}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {t(lang, "snp.save_and_continue", "Save Password & Continue")}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
