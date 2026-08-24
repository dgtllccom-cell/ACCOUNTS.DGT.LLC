"use client";

import { Building2, GitBranch } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export function OrganizationFoundation() {
  const lang = useActiveLanguage();

  const items = [
    {
      title: t(lang, "creg.companies_word", "Companies"),
      detail: t(lang, "creg.orgf_companies_detail", "Legal entities own roles, accounts, ledgers, documents, and audit logs."),
      icon: Building2
    },
    {
      title: t(lang, "ledger.orlv_branches_word", "Branches"),
      detail: t(lang, "creg.orgf_branches_detail", "Optional branch scope controls membership access and financial document ownership."),
      icon: GitBranch
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <section key={item.title} className="rounded-lg border bg-card p-5">
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <item.icon className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="font-medium">{item.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
        </section>
      ))}
    </div>
  );
}
