"use client";

import type { SupportedLanguage } from "@/lib/i18n/languages";
import { SuperAdminRoznamchaReportView } from "@/features/roznamcha/components/super-admin-roznamcha-report-view";

export function AllRoznamchaReportView({
  lang
}: {
  lang: SupportedLanguage;
}) {
  return (
    <SuperAdminRoznamchaReportView
      lang={lang}
      pageTitle="Roznamcha Management"
      typeFilter="super_admin"
    />
  );
}
