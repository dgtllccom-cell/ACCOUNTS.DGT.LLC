/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { requireOfficeSession } from "@/lib/api/office-hr";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  leaveType: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  reason: z.string().max(1000).nullable().optional(),
  status: z.string().optional()
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireOfficeSession(true);
    const { id } = await ctx.params;
    const b = patchSchema.parse(await request.json());
    await withLocalPg(async (sql) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ("leaveType" in b) patch.leave_type = b.leaveType;
      if ("fromDate" in b) patch.from_date = b.fromDate;
      if ("toDate" in b) patch.to_date = b.toDate;
      if ("reason" in b) patch.reason = b.reason ?? null;
      if ("status" in b) { patch.status = b.status; if (b.status === "Approved" || b.status === "Rejected") patch.approved_by = session.userId; }
      await sql`update office_leave_requests set ${sql(patch)} where id = ${id} and deleted_at is null`;
      return true;
    });
    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireOfficeSession(true);
    const { id } = await ctx.params;
    await withLocalPg(async (sql) => sql`update office_leave_requests set deleted_at = now() where id = ${id}`);
    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
