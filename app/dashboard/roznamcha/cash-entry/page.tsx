import { getRequestLanguage } from "@/lib/i18n/server";
import { CashEntryRegister } from "@/features/roznamcha/components/cash-entry-register";

export const metadata = { title: "Roznamcha — Cash Entry" };


export default async function CashEntryPage() {
  const lang = await getRequestLanguage();

  return <CashEntryRegister lang={lang} />;
}
