import { AssignTaskLanding } from "@/features/user-tasks/components/assign-task-landing";
import { getRequestLanguage } from "@/lib/i18n/server";

export const metadata = { title: "User Tasks — Assign Task" };
export const dynamic = "force-dynamic";

export default async function AssignTaskPage() {
  const lang = await getRequestLanguage();
  return <AssignTaskLanding lang={lang} />;
}
