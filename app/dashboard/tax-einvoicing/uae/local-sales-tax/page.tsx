import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeTaxPageShell } from "@/features/uae-tax/components/uae-tax-page-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "UAE Tax & e-Invoicing" };

export default async function TaxUaeLocalSalesTaxPage() {
  const session = await requireErpSession();
  return (
    <UaeTaxPageShell
      lang={session.preferredLanguage ?? "en"}
      titleKey="tax_einv.nav_local_sales_tax"
      phaseNote="tax_einv.phase_ingestion"
    />
  );
}
