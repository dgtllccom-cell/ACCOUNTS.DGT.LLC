import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeTaxReportsView } from "@/features/uae-tax/components/uae-tax-reports-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UAE Tax — Reports" };

export default async function Page() {
  const session = await requireErpSession();
  return <UaeTaxReportsView lang={session.preferredLanguage ?? "en"} />;
}
