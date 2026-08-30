import { UserTasksView } from "@/features/user-tasks/components/user-tasks-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "User Tasks — Team Tasks" };
export const dynamic = "force-dynamic";

export default async function TeamTasksPage() {
  const lang = await getRequestLanguage();
  return <UserTasksView scope="team" lang={lang} />;
}
