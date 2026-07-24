import { MoneyExchangeForm } from "@/features/roznamcha/components/money-exchange-form";
import { getRequestLanguage } from "@/lib/i18n/server";

export default async function MoneyExchangePage() {
  const lang = await getRequestLanguage();
  return <MoneyExchangeForm lang={lang} />;
}
