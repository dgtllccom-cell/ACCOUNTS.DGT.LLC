import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { transition } from "@/lib/user-tasks/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["accept", "start", "hold", "resume", "complete", "verify", "return", "reopen", "cancel"]),
  note: z.string().trim().max(4000).optional().nullable(),
  returnReason: z.string().trim().max(4000).optional().nullable(),
  evidenceTable: z.string().trim().max(120).optional().nullable(),
  evidenceId: z.string().uuid().optional().nullable(),
  evidenceRef: z.string().trim().max(240).optional().nullable(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid action", 400, parsed.error.flatten());
    const res = await transition(auth.session, id, parsed.data.action, {
      note: parsed.data.note ?? null,
      returnReason: parsed.data.returnReason ?? null,
      evidenceTable: parsed.data.evidenceTable ?? null,
      evidenceId: parsed.data.evidenceId ?? null,
      evidenceRef: parsed.data.evidenceRef ?? null,
    });
    try {
      await auditApiAction(request, {
        action: `user_tasks.${parsed.data.action}`,
        entityTable: "user_tasks",
        entityId: id,
        after: { status: res.status },
      });
    } catch {}
    return apiOk(res);
  } catch (error) {
    return taskErrorResponse(error);
  }
}
