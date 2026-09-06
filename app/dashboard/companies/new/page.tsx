import { Suspense } from "react";
import { CompanyIncorporationForm } from "@/features/companies/components/company-incorporation-form";
import { EntryMethodSelector } from "@/features/document-intelligence/components/entry-method-selector";
import { getCurrentErpSession } from "@/lib/auth/session";

export const metadata = { title: "New Company — Company Setup" };

export default async function NewCompanyPage({
  searchParams
}: {
  searchParams?: Promise<{ companyId?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const session = await getCurrentErpSession();
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading company setup...</div>}>
      <EntryMethodSelector
        targetModule="companies"
        domain="business"
        lang={session?.preferredLanguage ?? "en"}
        skipGate={Boolean(params?.companyId)}
      >
        <CompanyIncorporationForm initialCompanyId={params?.companyId} />
      </EntryMethodSelector>
    </Suspense>
  );
}
