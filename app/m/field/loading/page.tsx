import { requireMobileProfile } from "@/lib/permissions/require-mobile-profile";
import { getRequestLanguage } from "@/lib/i18n/server";
import { MobileLoadingView } from "@/features/mobile-field/components/mobile-loading-view";

export const dynamic = "force-dynamic";

export default async function MobileLoadingPage() {
  await requireMobileProfile("mobile_field");
  const lang = await getRequestLanguage();
  return <MobileLoadingView langProp={lang} />;
}
