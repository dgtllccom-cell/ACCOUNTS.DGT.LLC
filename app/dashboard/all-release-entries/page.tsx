import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { AllReleaseEntriesView } from "@/features/super-admin/components/all-release-entries-view";

export const metadata = { title: "All Release Entries" };


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AllReleaseEntriesPage() {
  const session = await getCurrentErpSession();
  
  if (!session) {
    redirect("/");
  }

  const isSuperAdmin = Boolean(session.isSuperAdmin || session.roles?.includes("super_admin"));
  if (!isSuperAdmin) {
    redirect("/dashboard");
  }

  let lang: any = "en";
  try {
    lang = await getRequestLanguage();
  } catch {
    lang = session.preferredLanguage || "en";
  }

  return (
    <div className="p-4 md:p-6">
      <AllReleaseEntriesView lang={lang} />
    </div>
  );
}
