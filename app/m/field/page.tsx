import { requireMobileProfile } from "@/lib/permissions/require-mobile-profile";
import { getRequestLanguage } from "@/lib/i18n/server";
import { MobileFieldHome } from "@/features/mobile-field/components/mobile-field-home";

export const dynamic = "force-dynamic";

export default async function MobileFieldHomePage() {
  const session = await requireMobileProfile("mobile_field");
  const lang = await getRequestLanguage();
  return (
    <MobileFieldHome
      langProp={lang}
      userName={session.fullName || session.email || "User"}
    />
  );
}
