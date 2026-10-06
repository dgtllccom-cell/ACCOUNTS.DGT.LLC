import { PerformanceReportView } from "@/features/user-tasks/components/performance-report-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "User Tasks — Performance Report" };
export const dynamic = "force-dynamic";

export default async function TaskPerformancePage() {
  const lang = await getRequestLanguage();
  return <PerformanceReportView lang={lang} />;
}
