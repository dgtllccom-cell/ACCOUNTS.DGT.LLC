import { requireMobileProfile } from "@/lib/permissions/require-mobile-profile";
import { getRequestLanguage } from "@/lib/i18n/server";
import { MobileLedgerView } from "@/features/mobile-cash/components/mobile-ledger-view";

export const dynamic = "force-dynamic";

export default async function MobileLedgerPage() {
  await requireMobileProfile("mobile_cash_ledger");
  const lang = await getRequestLanguage();
  return <MobileLedgerView langProp={lang} />;
}
