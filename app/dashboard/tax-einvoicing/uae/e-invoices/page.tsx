import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeEInvoiceView } from "@/features/uae-tax/components/uae-einvoice-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UAE e-Invoicing — Tax Invoices" };

export default async function Page() {
  const session = await requireErpSession();
  return <UaeEInvoiceView lang={session.preferredLanguage ?? "en"} mode="invoices" />;
}
