import { redirect } from "next/navigation";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { AllReleaseEntriesView } from "@/features/super-admin/components/all-release-entries-view";

export const dynamic = "force-dynamic";

export default async function AllReleaseEntriesPage() {
  // UI-level permission guard (the API is independently gated at the data level).
  const session = await requireErpSession();
  if (!session.isSuperAdmin) redirect("/dashboard");

  const lang = await getRequestLanguage();
  return (
    <div className="p-4 md:p-6">
      <AllReleaseEntriesView lang={lang} />
    </div>
  );
}
