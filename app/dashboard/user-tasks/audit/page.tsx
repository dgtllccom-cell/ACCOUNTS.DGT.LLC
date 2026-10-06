import { TaskAuditView } from "@/features/user-tasks/components/task-audit-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "User Tasks — Audit History" };
export const dynamic = "force-dynamic";

export default async function TaskAuditPage() {
  const lang = await getRequestLanguage();
  return <TaskAuditView lang={lang} />;
}
