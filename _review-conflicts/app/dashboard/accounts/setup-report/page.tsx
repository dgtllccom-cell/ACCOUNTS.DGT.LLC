import { AccountSetupReport } from "@/features/accounts/components/account-setup-report";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = {
  title: "Account Setup Report",
};

export default async function Page() {
  const lang = await getRequestLanguage();
  return <AccountSetupReport lang={lang} />;
}
