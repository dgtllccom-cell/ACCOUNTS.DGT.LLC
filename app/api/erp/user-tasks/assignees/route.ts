import { apiOk } from "@/lib/api/response";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { listAssignees } from "@/lib/user-tasks/service";
import { canManageTasks } from "@/lib/user-tasks/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  try {
    if (!canManageTasks(auth.session)) return apiOk({ users: [] });
    const users = await listAssignees(auth.session);
    return apiOk({ users });
  } catch (error) {
    return taskErrorResponse(error, { users: [] });
  }
}
