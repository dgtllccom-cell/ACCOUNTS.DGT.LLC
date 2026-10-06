import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { SystemAuditAndFormsDirectoryView } from "@/features/reports/components/system-audit-and-forms-directory";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "ERP Master Forms Directory & Audit Progress Report",
  description: "Comprehensive catalog of all ERP forms, routes, modules, and chronological development milestones from project inception to date.",
};

export default async function SystemFormsDirectoryPage() {
  const session = await requireErpSession();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;

  return (
    <div className="w-full">
      <SystemAuditAndFormsDirectoryView lang={lang} />
    </div>
  );
}
