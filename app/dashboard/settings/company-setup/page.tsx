import { CompanyIncorporationForm } from "@/features/companies/components/company-incorporation-form";

export const metadata = { title: "Settings — Company Setup" };


export default async function CompanySetupPage({
  searchParams
}: {
  searchParams?: Promise<{ companyId?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  return <CompanyIncorporationForm initialCompanyId={params?.companyId} />;
}

