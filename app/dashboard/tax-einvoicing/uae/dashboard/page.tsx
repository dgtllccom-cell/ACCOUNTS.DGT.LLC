import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeTaxControlCenter } from "@/features/uae-tax/components/uae-tax-control-center";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UAE Tax & e-Invoicing Control Center",
  description: "Live UAE VAT position across sales, purchases, expenses, import, export, recovery and e-Invoicing.",
};

export default async function TaxUaeDashboardPage() {
  const session = await requireErpSession();
  return <UaeTaxControlCenter lang={session.preferredLanguage ?? "en"} />;
}
