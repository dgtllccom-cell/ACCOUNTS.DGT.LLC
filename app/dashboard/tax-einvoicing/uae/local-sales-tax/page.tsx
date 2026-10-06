import type { Metadata } from "next";
import { requireErpSession } from "@/lib/auth/session";
import { UaeTaxLinesView } from "@/features/uae-tax/components/uae-tax-lines-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "UAE Tax — Local Sales Output VAT" };

export default async function TaxUaeLocalSalesTaxPage() {
  const session = await requireErpSession();
  return (
    <UaeTaxLinesView
      lang={session.preferredLanguage ?? "en"}
      titleKey="tax_einv.nav_local_sales_tax"
      category="local_sale"
    />
  );
}
