import { redirect } from "next/navigation";
import { getCurrentErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { EntryDetailView } from "@/features/super-admin/components/entry-detail-view";

export const metadata = { title: "All Release Entries" };


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EntryDetailPage({
  params, searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ module?: string; src?: string }>;
}) {
  // UI-level permission guard (the API is independently gated at the data level).
  const session = await getCurrentErpSession();
  if (!session) redirect("/");

  const isSuperAdmin = Boolean(session.isSuperAdmin || session.roles?.includes("super_admin"));
  if (!isSuperAdmin) redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;
  let lang: any = "en";
  try {
    lang = await getRequestLanguage();
  } catch {
    lang = session.preferredLanguage || "en";
  }

  return (
    <div className="p-4 md:p-6">
      <EntryDetailView id={id} module={sp.module || "Roznamcha"} src={sp.src || "Roznamcha"} lang={lang} />
    </div>
  );
}
