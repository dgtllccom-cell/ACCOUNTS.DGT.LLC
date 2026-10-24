"use client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { Home, ShieldAlert } from "lucide-react";
import { evaluateRouteAccess, type RouteAccessInput } from "@/lib/navigation/route-policy";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";

/** The same route decision used by the server layout and sidebar. The former
 * extra shipping-prefix blacklist hid explicitly allotted account/user forms.
 * Backend APIs continue to enforce permissions, country, branch and row domain.
 */
export function DashboardContentGate({ children, lang, ...access }: RouteAccessInput & {
  children: ReactNode;
  lang: SupportedLanguage;
}) {
  if (evaluateRouteAccess(access).allowed) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-card rounded-2xl border border-border shadow-xs my-4 animate-in fade-in zoom-in-95 duration-150">
      <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 shadow-inner">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-black text-foreground tracking-tight mb-2">
        {t(lang, "rules.access_restricted_title", "Form Access Restricted / رسائی محدود ہے")}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        {t(lang, "rules.access_restricted_desc", "This form has not been allotted to your account by the administrator. Only allotted modules are accessible.")}
      </p>
      <Link href="/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md hover:bg-primary/90 transition-all cursor-pointer">
        <Home className="w-4 h-4" />
        {t(lang, "rules.return_to_dashboard", "Return to Dashboard / ڈیش بورڈ پر واپس جائیں")}
      </Link>
    </div>
  );
}
