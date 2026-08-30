import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireTaskSession, taskErrorResponse } from "@/lib/user-tasks/route-helpers";
import { createTask, listTasks } from "@/lib/user-tasks/service";
import { canManageTasks } from "@/lib/user-tasks/access";
import { RELATED_MODULES } from "@/lib/user-tasks/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  try {
    const p = request.nextUrl.searchParams;
    const scope = (p.get("scope") || "my").toLowerCase();
    const rows = await listTasks(auth.session, {
      scope: (["my", "team", "overdue", "completed", "all"].includes(scope) ? scope : "my") as any,
      status: p.get("status"),
      priority: p.get("priority"),
      q: p.get("q"),
      assigneeId: p.get("assigneeId"),
      countryId: p.get("countryId"),
      module: p.get("module"),
      limit: p.get("limit") ? Number(p.get("limit")) : undefined,
    });
    return apiOk({ rows, canManage: canManageTasks(auth.session) });
  } catch (error) {
    return taskErrorResponse(error, { rows: [], canManage: false });
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(4000).optional().nullable(),
  instructions: z.string().trim().max(8000).optional().nullable(),
  remarks: z.string().trim().max(4000).optional().nullable(),
  assignedTo: z.string().uuid(),
  countryId: z.string().uuid().optional().nullable(),
  countryBranchId: z.string().uuid().optional().nullable(),
  cityBranchId: z.string().uuid().optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
  relatedModule: z.enum(RELATED_MODULES).optional().nullable(),
  relatedRecordTable: z.string().trim().max(120).optional().nullable(),
  relatedRecordId: z.string().uuid().optional().nullable(),
  relatedRecordLabel: z.string().trim().max(240).optional().nullable(),
  relatedRoute: z.string().trim().max(400).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().nullable(),
  startDate: z.string().trim().max(40).optional().nullable(),
  dueAt: z.string().trim().max(40).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const auth = await requireTaskSession();
  if ("response" in auth) return auth.response;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return apiError("VALIDATION", "Invalid task", 400, parsed.error.flatten());
    const { id, taskNo } = await createTask(auth.session, parsed.data);
    try {
      await auditApiAction(request, {
        action: "user_tasks.create",
        entityTable: "user_tasks",
        entityId: id,
        after: { taskNo, assignedTo: parsed.data.assignedTo, title: parsed.data.title },
      });
    } catch {}
    return apiCreated({ id, taskNo });
  } catch (error) {
    return taskErrorResponse(error);
  }
}
