import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeEInvoiceView } from "@/features/uae-tax/components/uae-einvoice-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UAE e-Invoicing — ASP / FTA Status" };

export default async function Page() {
  const session = await requireErpSession();
  return <UaeEInvoiceView lang={session.preferredLanguage ?? "en"} mode="asp_status" />;
}
