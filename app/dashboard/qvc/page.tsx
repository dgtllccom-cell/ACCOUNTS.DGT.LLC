import { requireErpSession } from "@/lib/auth/session";
import { QvcQueueView } from "@/features/qvc/components/qvc-queue-view";

export const metadata = { title: "QVC Review Queue" };

export default async function QvcPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string }> }) {
  await requireErpSession();
  const sp = searchParams ? await searchParams : undefined;
  const allowedStatuses = new Set(["qvc_pending", "needs_review", "qvc_approved", "error", ""]);
  const initialFilter = allowedStatuses.has(sp?.status ?? "") ? (sp?.status ?? "qvc_pending") : "qvc_pending";
  return <QvcQueueView initialQuery={sp?.q ?? ""} initialFilter={initialFilter} />;
}

