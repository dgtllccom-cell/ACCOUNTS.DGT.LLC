import { getRequestLanguage } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/ui";
import { AccountGeneralReportView } from "@/features/accounts/components/account-general-report-view";

export default async function NewAccountGeneralReportPage({
  searchParams
}: {
  searchParams?: Promise<{ accountId?: string }>;
}) {
  const lang = await getRequestLanguage();
  const params = searchParams ? await searchParams : undefined;

  return (
    <AccountGeneralReportView
      lang={lang}
      pageTitle={t(lang, "nav.new_account_general_report")}
      subtitle=""
      initialAccountId={params?.accountId ?? null}
      showProfilePanel={false}
    />
  );
}
