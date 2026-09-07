import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireErpSession } from "@/lib/auth/session";
import { resolveReportScope } from "@/lib/permissions/middleware";
import { resolveReportContext } from "@/lib/reports/resolve-report-context";
import { AccessRegisterView } from "@/features/reports/components/access-register-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Access Registration Report — ERP" };

export default async function AccessRegisterReportPage() {
  const session = await requireErpSession();
  // same permission boundary as the API route — super admin only
  const scope = resolveReportScope(session);
  if (scope.level !== "global") redirect("/dashboard/reports");

  const context = await resolveReportContext(session);
  return <AccessRegisterView context={context} />;
}
