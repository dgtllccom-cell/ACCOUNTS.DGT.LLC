import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeTaxComingSoonView } from "@/features/uae-tax/components/uae-tax-coming-soon-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tax & e-Invoicing — Coming Soon",
};

export default async function TaxEinvoicingComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const session = await requireErpSession();
  const { country } = await searchParams;
  return <UaeTaxComingSoonView lang={session.preferredLanguage ?? "en"} country={country} />;
}
