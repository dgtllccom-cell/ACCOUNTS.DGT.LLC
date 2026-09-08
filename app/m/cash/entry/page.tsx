import { requireMobileProfile } from "@/lib/permissions/require-mobile-profile";
import { getRequestLanguage } from "@/lib/i18n/server";
import { MobileCashEntryView } from "@/features/mobile-cash/components/mobile-cash-entry-view";

export const dynamic = "force-dynamic";

export default async function MobileCashEntryPage() {
  await requireMobileProfile("mobile_cash_ledger");
  const lang = await getRequestLanguage();
  return <MobileCashEntryView langProp={lang} />;
}
