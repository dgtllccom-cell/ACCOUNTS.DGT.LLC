import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { AllTaxesView } from "@/features/uae-tax/components/all-taxes-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "All Taxes — Tax Setup & Rules",
  description: "Central tax structure: one container per country. United Arab Emirates is fully active.",
};

export default async function AllTaxesPage() {
  const session = await requireErpSession();
  return <AllTaxesView lang={session.preferredLanguage ?? "en"} />;
}
