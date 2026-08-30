import { apiOk } from "@/lib/api/response";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { summary } from "@/lib/user-tasks/service";
import { canManageTasks } from "@/lib/user-tasks/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  try {
    const data = await summary(auth.session);
    return apiOk({ ...data, canManage: canManageTasks(auth.session) });
  } catch (error) {
    return taskErrorResponse(error, {
      myOpen: 0, myOverdue: 0, myNew: 0, awaitingMyVerification: 0, unread: 0, notifications: [], canManage: false,
    });
  }
}
