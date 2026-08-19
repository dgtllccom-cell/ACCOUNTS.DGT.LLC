import { redirect } from "next/navigation";
import { requireErpSession } from "@/lib/auth/session";
import { getRequestLanguage } from "@/lib/i18n/server";
import { EntryDetailView } from "@/features/super-admin/components/entry-detail-view";

export const dynamic = "force-dynamic";

export default async function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // UI-level permission guard (the API is independently gated at the data level).
  const session = await requireErpSession();
  if (!session.isSuperAdmin) redirect("/dashboard");

  const { id } = await params;
  const lang = await getRequestLanguage();
  return (
    <div className="p-4 md:p-6">
      <EntryDetailView id={id} lang={lang} />
    </div>
  );
}
