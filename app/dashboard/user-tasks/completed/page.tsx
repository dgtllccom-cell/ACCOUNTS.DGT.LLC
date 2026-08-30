import { UserTasksView } from "@/features/user-tasks/components/user-tasks-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "User Tasks — Completed / Verified" };
export const dynamic = "force-dynamic";

export default async function CompletedTasksPage() {
  const lang = await getRequestLanguage();
  return <UserTasksView scope="completed" lang={lang} />;
}
