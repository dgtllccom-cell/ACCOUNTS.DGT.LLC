import { AccountProfileView } from "@/features/accounts/components/account-profile-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export default async function AccountViewPage({
  searchParams
}: {
  searchParams?: Promise<{ accountId?: string }>;
}) {
  const lang = await getRequestLanguage();
  const params = searchParams ? await searchParams : undefined;

  return (
    <AccountProfileView
      lang={lang}
      accountId={params?.accountId ?? ""}
    />
  );
}
