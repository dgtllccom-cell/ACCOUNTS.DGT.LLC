import { requireMobileProfile } from "@/lib/permissions/require-mobile-profile";
import { getRequestLanguage } from "@/lib/i18n/server";
import { MobileCashHome } from "@/features/mobile-cash/components/mobile-cash-home";

export const dynamic = "force-dynamic";

export default async function MobileCashHomePage() {
  const session = await requireMobileProfile("mobile_cash_ledger");
  const lang = await getRequestLanguage();
  return <MobileCashHome langProp={lang} userName={session.fullName || session.email || "User"} />;
}
