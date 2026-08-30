import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { markNotificationsRead } from "@/lib/user-tasks/service";

export const dynamic = "force-dynamic";

const schema = z.object({ ids: z.array(z.string().uuid()).optional() });

export async function POST(request: NextRequest) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  try {
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return apiError("VALIDATION", "Invalid request", 400, parsed.error.flatten());
    const count = await markNotificationsRead(auth.session, parsed.data.ids);
    return apiOk({ marked: count });
  } catch (error) {
    return taskErrorResponse(error, { marked: 0 });
  }
}
