import { requireErpSession } from "@/lib/auth/session";
import { QvcQueueView } from "@/features/qvc/components/qvc-queue-view";

export const metadata = { title: "QVC Review Queue" };

export default async function QvcPage() {
  await requireErpSession();
  return <QvcQueueView />;
}
