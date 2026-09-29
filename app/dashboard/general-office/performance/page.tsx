import { Suspense } from "react";
import { requireErpSession } from "@/lib/auth/session";
import { PerformanceAppraisalView } from "@/features/hrm/components/performance-appraisal-view";

export const dynamic = "force-dynamic";

export const metadata = { title: "Employee Performance & Appraisal — HRM" };

export default async function PerformancePage() {
  const session = await requireErpSession();
  return (
    <Suspense>
      <PerformanceAppraisalView lang={session.preferredLanguage ?? "en"} />
    </Suspense>
  );
}
