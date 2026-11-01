import { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { accessibleCategories } from "@/lib/reports/center-nav";
import { defaultDomain } from "@/lib/reports/center-register";
import { ReportsCenterNav } from "@/features/reports/components/reports-center-nav";
import { ReportsCenterPage } from "@/features/reports/components/reports-center-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Country Reports — ERP", description: "The Reports Center register, limited to your own country / branch scope." };

// the historic country-reports URL: the same Reports Center register (one implementation), opened with this title
export default async function CountryReportsPage() {
  const session = await requireErpSession();
  const lang = session.preferredLanguage ?? "en";
  return (
    <div className="w-full px-3 py-4 sm:px-6 lg:px-8">
      <ReportsCenterNav lang={lang} items={accessibleCategories(session)} activeKey="country" />
      <ReportsCenterPage lang={lang} initialDomain={defaultDomain(session)} titleKey="title_country" titleFallback="Country Reports" />
    </div>
  );
}
