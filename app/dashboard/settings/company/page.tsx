import { CompanySetupManager } from "@/features/companies/components/company-setup-manager";
import { getCurrentErpSession } from "@/lib/auth/session";

export const metadata = { title: "Settings — Company" };

export default async function CompanySettingsPage() {
  const session = await getCurrentErpSession();
  return <CompanySetupManager lang={session?.preferredLanguage ?? "en"} />;
}


