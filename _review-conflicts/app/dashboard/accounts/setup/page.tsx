import { NewAccountSetup } from "@/features/accounts/components/new-account-setup";
import { getRequestLanguage } from "@/lib/i18n/server";

export default async function NewAccountPage({
  searchParams
}: {
  searchParams?: Promise<{ accountId?: string }>;
}) {
  const lang = await getRequestLanguage();
  const params = searchParams ? await searchParams : undefined;
  return <NewAccountSetup lang={lang} initialAccountId={params?.accountId} />;
}
