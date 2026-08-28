import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeTaxAuditView } from "@/features/uae-tax/components/uae-tax-audit-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UAE Tax & e-Invoicing" };

export default async function Page() {
  const session = await requireErpSession();
  return <UaeTaxAuditView lang={session.preferredLanguage ?? "en"} />;
}
