import { requireMobileProfile } from "@/lib/permissions/require-mobile-profile";
import { getRequestLanguage } from "@/lib/i18n/server";
import { MobileTasksView } from "@/features/mobile-field/components/mobile-tasks-view";

export const dynamic = "force-dynamic";

export default async function MobileTasksPage() {
  await requireMobileProfile("mobile_field");
  const lang = await getRequestLanguage();
  return <MobileTasksView langProp={lang} />;
}
