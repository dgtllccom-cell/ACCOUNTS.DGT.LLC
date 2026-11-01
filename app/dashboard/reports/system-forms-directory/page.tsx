import { Metadata } from "next";
import { forbidden } from "next/navigation";
import { requireErpSession } from "@/lib/auth/session";
import { accessibleCategories } from "@/lib/reports/center-nav";
import { ReportsCenterNav } from "@/features/reports/components/reports-center-nav";
import { SystemAuditAndFormsDirectoryView } from "@/features/reports/components/system-audit-and-forms-directory";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export const metadata: Metadata = {
  title: "ERP Master Forms Directory & Audit Progress Report",
  description: "Comprehensive catalog of all ERP forms, routes, modules, and chronological development milestones from project inception to date.",
};

export default async function SystemFormsDirectoryPage() {
  const session = await requireErpSession();
  // an internal system catalogue (every form, route and module): Super Admin only, whatever the route policy says
  if (!session.isSuperAdmin) forbidden();
  const lang = (session.preferredLanguage ?? "en") as SupportedLanguage;

  return (
    <div className="w-full">
      <div className="px-3 pt-3 sm:px-6"><ReportsCenterNav lang={lang} items={accessibleCategories(session)} activeKey="forms" /></div>
      <SystemAuditAndFormsDirectoryView lang={lang} />
    </div>
  );
}
