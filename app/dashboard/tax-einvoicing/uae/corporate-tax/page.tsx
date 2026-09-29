import type { Metadata } from "next";
import { Suspense } from "react";
import { requireErpSession } from "@/lib/auth/session";
import { UaeCorporateTaxView } from "@/features/uae-tax/components/uae-corporate-tax-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UAE Tax — Corporate Tax" };

export default async function Page() {
  const session = await requireErpSession();
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Suspense>
        <UaeCorporateTaxView lang={session.preferredLanguage ?? "en"} />
      </Suspense>
    </div>
  );
}
