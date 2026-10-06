import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeVatRecoveryView } from "@/features/uae-tax/components/uae-vat-recovery-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UAE Tax — VAT Recovery & Refunds" };

export default async function Page() {
  const session = await requireErpSession();
  return <UaeVatRecoveryView lang={session.preferredLanguage ?? "en"} />;
}
