import { AccountGeneralReportView } from "@/features/accounts/components/account-general-report-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export default async function AccountsPage({
  searchParams
}: {
  searchParams?: Promise<{ accountId?: string; created?: string }>;
}) {
  const lang = await getRequestLanguage();
  const params = searchParams ? await searchParams : undefined;

  return (
    <AccountGeneralReportView
      lang={lang}
      pageTitle="Account Master Registry & Search Report"
      subtitle="All Account Master records with country, city branch, company ownership, balances, and creation details."
      initialAccountId={params?.accountId ?? null}
      highlightCreated={params?.created === "1"}
      showProfilePanel={false}
    />
  );
}
