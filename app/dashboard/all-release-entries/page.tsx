import { cookies } from "next/headers";
import { normalizeLanguage } from "@/lib/i18n/languages";
import { AllReleaseEntriesView } from "@/features/super-admin/components/all-release-entries-view";

export const dynamic = "force-dynamic";

export default async function AllReleaseEntriesPage() {
  const cookieStore = await cookies();
  const lang = normalizeLanguage(cookieStore.get("erp_lang")?.value) ?? "en";
  return (
    <div className="p-4 md:p-6">
      <AllReleaseEntriesView lang={lang} />
    </div>
  );
}
