import { NewAccountWithEntryMethods } from "@/features/accounts/components/new-account-with-entry-methods";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "New Account Entry" };


export default async function NewAccountPage({
  searchParams
}: {
  searchParams?: Promise<{ accountId?: string; mode?: string; new?: string }>;
}) {
  const lang = await getRequestLanguage();
  const params = searchParams ? await searchParams : undefined;
  const initialMode = (params?.mode === "form" || params?.new === "1" || !!params?.accountId) ? "form" : undefined;
  return <NewAccountWithEntryMethods lang={lang} initialAccountId={params?.accountId} initialMode={initialMode} />;
}
