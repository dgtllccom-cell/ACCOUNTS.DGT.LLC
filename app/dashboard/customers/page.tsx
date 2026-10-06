import { Suspense } from "react";
import type { Metadata } from "next";
import { getRequestLanguage } from "@/lib/i18n/server";
import { CustomerList } from "@/features/customers/components/customer-list";

export const metadata: Metadata = {
  title: "Customers & Party Registry — Digital Dock ERP",
  description: "Enterprise customer directory, Party 360, ledger accounts, and contacts."
};

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const lang = await getRequestLanguage();
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground animate-pulse">Loading Customer Registry...</div>}>
      <CustomerList lang={lang} />
    </Suspense>
  );
}
