import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeTaxSettingsView } from "@/features/uae-tax/components/uae-tax-settings-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "UAE Tax Settings",
  description: "Legal tax entities, TRN, branch mapping, filing calendar, VAT rates and Designated Zones.",
};

export default async function TaxUaeSettingsPage() {
  const session = await requireErpSession();
  return <UaeTaxSettingsView lang={session.preferredLanguage ?? "en"} />;
}
