import type { Metadata } from "next";
import { Suspense } from "react";
import { requireErpSession } from "@/lib/auth/session";
import { PkSalesTaxView } from "@/features/pk-tax/components/pk-sales-tax-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pakistan Tax — Sales Tax" };

export default async function Page() {
  const session = await requireErpSession();
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Suspense>
        <PkSalesTaxView lang={session.preferredLanguage ?? "en"} />
      </Suspense>
    </div>
  );
}
