import { UserTasksView } from "@/features/user-tasks/components/user-tasks-view";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "User Tasks — My Tasks" };
export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  const lang = await getRequestLanguage();
  return <UserTasksView scope="my" lang={lang} />;
}
