import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { CrmInsightsPanel } from "@/features/crm/components/crm-insights-panel";

export const metadata: Metadata = { title: "CRM Insights — Digital Dock ERP" };
export const dynamic = "force-dynamic";

export default async function CrmInsightsPage() {
  const session = await requireErpSession();
  return (
    <div className="w-full px-3 py-4 sm:px-6 lg:px-8">
      <CrmInsightsPanel lang={session.preferredLanguage ?? "en"} />
    </div>
  );
}
