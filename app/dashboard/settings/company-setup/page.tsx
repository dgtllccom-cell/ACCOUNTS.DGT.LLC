import { CompanySetupManager } from "@/features/companies/components/company-setup-manager";
import { getCurrentErpSession } from "@/lib/auth/session";

export const metadata = { title: "Settings — Company Setup" };

export default async function CompanySetupPage({
  searchParams
}: {
  searchParams?: Promise<{ companyId?: string; action?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const session = await getCurrentErpSession();
  return (
    <CompanySetupManager
      initialCompanyId={params?.companyId}
      initialAction={params?.action}
      lang={session?.preferredLanguage ?? "en"}
    />
  );
}

