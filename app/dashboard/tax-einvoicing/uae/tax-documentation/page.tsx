import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeTaxDocumentationView } from "@/features/uae-tax/components/uae-tax-documentation-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UAE Tax — Documentation & Source Invoices" };

export default async function Page() {
  const session = await requireErpSession();
  return <UaeTaxDocumentationView lang={session.preferredLanguage ?? "en"} />;
}
