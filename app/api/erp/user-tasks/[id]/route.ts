import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { editTask, getTask, markTaskSeen, transition } from "@/lib/user-tasks/service";
import { RELATED_MODULES } from "@/lib/user-tasks/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const result = await getTask(auth.session, id);
    if (!result || (result as any).setupPending) return apiOk({ setupPending: true });
    if ((result as any).notFound) return apiError("NOT_FOUND", "Task not found", 404);
    if ((result as any).forbidden) return apiError("FORBIDDEN", "You cannot view this task", 403);
    // opening the task clears its unread notifications for this user
    try { await markTaskSeen(auth.session, id); } catch {}
    return apiOk(result);
  } catch (error) {
    return taskErrorResponse(error);
  }
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  instructions: z.string().trim().max(8000).optional().nullable(),
  remarks: z.string().trim().max(4000).optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  startDate: z.string().trim().max(40).optional().nullable(),
  dueAt: z.string().trim().max(40).optional().nullable(),
  relatedModule: z.enum(RELATED_MODULES).optional().nullable(),
  relatedRecordTable: z.string().trim().max(120).optional().nullable(),
  relatedRecordId: z.string().uuid().optional().nullable(),
  relatedRecordLabel: z.string().trim().max(240).optional().nullable(),
  relatedRoute: z.string().trim().max(400).optional().nullable(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid patch", 400, parsed.error.flatten());
    await editTask(auth.session, id, parsed.data as Record<string, unknown>);
    try { await auditApiAction(request, { action: "user_tasks.edit", entityTable: "user_tasks", entityId: id, after: parsed.data }); } catch {}
    return apiOk({ ok: true });
  } catch (error) {
    return taskErrorResponse(error);
  }
}

// DELETE = cancel the task (soft, via the workflow — keeps the audit trail).
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  try {
    const url = new URL(request.url);
    const reason = url.searchParams.get("reason") || "Cancelled by manager";
    const res = await transition(auth.session, id, "cancel", { note: reason });
    try { await auditApiAction(request, { action: "user_tasks.cancel", entityTable: "user_tasks", entityId: id, after: { reason } }); } catch {}
    return apiOk(res);
  } catch (error) {
    return taskErrorResponse(error);
  }
}
