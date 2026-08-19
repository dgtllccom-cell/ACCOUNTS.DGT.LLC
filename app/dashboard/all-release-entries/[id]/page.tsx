import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { EntryDetailView } from "@/features/super-admin/components/entry-detail-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // UI-level permission guard (the API is independently gated at the data level).
  const session = await getCurrentErpSession();
  if (!session) redirect("/");

  const isSuperAdmin = Boolean(session.isSuperAdmin || session.roles?.includes("super_admin"));
  if (!isSuperAdmin) redirect("/dashboard");

  const { id } = await params;
  let lang: any = "en";
  try {
    lang = await getRequestLanguage();
  } catch {
    lang = session.preferredLanguage || "en";
  }
  return (
    <div className="p-4 md:p-6">
      <EntryDetailView id={id} lang={lang} />
    </div>
  );
}
