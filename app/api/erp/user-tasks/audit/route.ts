import { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { auditTrail } from "@/lib/user-tasks/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  try {
    const p = request.nextUrl.searchParams;
    const rows = await auditTrail(auth.session, {
      taskId: p.get("taskId"),
      userId: p.get("userId"),
      from: p.get("from"),
      to: p.get("to"),
      limit: p.get("limit") ? Number(p.get("limit")) : undefined,
    });
    return apiOk({ rows });
  } catch (error) {
    return taskErrorResponse(error, { rows: [] });
  }
}
