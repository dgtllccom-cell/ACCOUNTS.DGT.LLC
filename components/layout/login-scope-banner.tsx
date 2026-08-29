"use client";

import { ShieldCheck, ChevronRight } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { roleLabel } from "@/lib/hooks/use-branch-user-context";
import type { ErpScope } from "@/lib/hooks/use-erp-scope";
import { cn } from "@/lib/utils";

/**
 * Mandatory "Logged-in Scope" banner (spec A).
 *
 * Renders the AUTHENTICATED, server-resolved scope — Country → Main Branch →
 * City Branch → Role — from `useErpScope()`. Never from manually-selected
 * frontend data. Shown at the top of scoped create/setup screens.
 */
export function LoginScopeBanner({ scope, className }: { scope: ErpScope; className?: string }) {
  const lang = useActiveLanguage();
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fb: string) => t(lang, key as never, fb);

  const parts: string[] = [];
  if (scope.isSuperAdmin) {
    parts.push(tt("scope.all_countries", "All Countries"), tt("scope.all_branches", "All Branches"));
  } else {
    if (scope.countryName) parts.push(scope.countryName);
    if (scope.countryBranchName) parts.push(scope.countryBranchName);
    else if (!scope.cityBranchName && scope.mode === "country") parts.push(tt("scope.country_wide", "Country-wide"));
    if (scope.cityBranchName) parts.push(scope.cityBranchName);
    if (parts.length === 0) parts.push(tt("scope.unassigned", "No scope assigned"));
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200",
        className,
      )}
      aria-label={tt("scope.logged_in_scope", "Logged-in Scope")}
    >
      <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      <span className="uppercase tracking-wide text-blue-500 dark:text-blue-400">
        {tt("scope.logged_in_scope", "Logged-in Scope")}:
      </span>
      {scope.loading ? (
        <span className="text-blue-400">…</span>
      ) : scope.error ? (
        <span className="text-rose-500">{scope.error}</span>
      ) : (
        <span className="flex flex-wrap items-center gap-1">
          {parts.map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className={cn("h-3 w-3 text-blue-400", isRtl && "rotate-180")} />}
              <b className="font-bold">{p}</b>
            </span>
          ))}
          <span className="flex items-center gap-1">
            <ChevronRight className={cn("h-3 w-3 text-blue-400", isRtl && "rotate-180")} />
            <b className="font-bold">{scope.role ? t(lang, `role.${scope.role}` as never, roleLabel(scope.role)) : roleLabel(scope.role)}</b>
          </span>
        </span>
      )}
    </div>
  );
}
