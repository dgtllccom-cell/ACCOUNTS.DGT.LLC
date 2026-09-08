"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import type { SupportedLanguage } from "@/lib/i18n/languages";

/**
 * The one chrome for every Brother-User mobile screen: a big title bar with an
 * optional back button and a log-out button. Deliberately minimal — no sidebar,
 * no dashboard, large touch targets, follows the active language + RTL.
 */
export function MobileCashShell({
  title,
  langProp,
  showBack = false,
  children,
}: {
  title: string;
  langProp?: SupportedLanguage;
  showBack?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const s = useErpScreen("mcash", langProp);

  return (
    <div dir={s.dir} className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
        {showBack ? (
          <button
            type="button"
            onClick={() => router.push("/m/cash")}
            className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
            aria-label={s.t("back", "Back")}
          >
            <ArrowLeft className={`h-5 w-5 ${s.isRtl ? "rotate-180" : ""}`} />
          </button>
        ) : null}
        <h1 className="flex-1 truncate text-lg font-black tracking-tight">{title}</h1>
        <button
          type="button"
          onClick={() => {
            fetch("/api/erp/auth/logout", { method: "POST" }).then(() => {
              window.location.href = "/auth/login";
            });
          }}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 text-xs font-bold text-rose-600 active:scale-95 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden xs:inline">{s.t("logout", "Log out")}</span>
        </button>
      </header>
      <main className="flex-1 px-3 py-4">{children}</main>
    </div>
  );
}
