import { requireMobileProfile } from "@/lib/permissions/require-mobile-profile";
import { getRequestLanguage } from "@/lib/i18n/server";
import { MobileDocsView } from "@/features/mobile-field/components/mobile-docs-view";

export const dynamic = "force-dynamic";

export default async function MobileDocsPage() {
  const session = await requireMobileProfile("mobile_field");
  const lang = await getRequestLanguage();
  return <MobileDocsView langProp={lang} currentUserId={session.userId} />;
}
