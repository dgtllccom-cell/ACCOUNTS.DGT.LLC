import { requireMobileProfile } from "@/lib/permissions/require-mobile-profile";
import { getRequestLanguage } from "@/lib/i18n/server";
import { MobileCashbookView } from "@/features/mobile-cash/components/mobile-cashbook-view";

export const dynamic = "force-dynamic";

export default async function MobileJournalPage() {
  await requireMobileProfile("mobile_cash_ledger");
  const lang = await getRequestLanguage();
  return <MobileCashbookView langProp={lang} mode="journal" />;
}
