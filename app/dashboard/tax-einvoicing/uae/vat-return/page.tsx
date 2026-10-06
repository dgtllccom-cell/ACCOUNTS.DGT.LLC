import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeVatReturnView } from "@/features/uae-tax/components/uae-vat-return-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UAE Tax — VAT Return (FTA VAT 201)" };

export default async function Page() {
  const session = await requireErpSession();
  return <UaeVatReturnView lang={session.preferredLanguage ?? "en"} />;
}
