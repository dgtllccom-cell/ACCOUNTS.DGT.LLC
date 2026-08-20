/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { requireOfficeSession } from "@/lib/api/office-hr";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  attendanceDate: z.string().optional(),
  checkIn: z.string().nullable().optional(),
  checkOut: z.string().nullable().optional(),
  status: z.string().optional(),
  workHours: z.number().nullable().optional(),
  notes: z.string().max(1000).nullable().optional()
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireOfficeSession(true);
    const { id } = await ctx.params;
    const b = patchSchema.parse(await request.json());
    await withLocalPg(async (sql) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ("attendanceDate" in b) patch.attendance_date = b.attendanceDate;
      if ("checkIn" in b) patch.check_in = b.checkIn || null;
      if ("checkOut" in b) patch.check_out = b.checkOut || null;
      if ("status" in b) patch.status = b.status;
      if ("workHours" in b) patch.work_hours = b.workHours ?? null;
      if ("notes" in b) patch.notes = b.notes ?? null;
      await sql`update office_attendance set ${sql(patch)} where id = ${id} and deleted_at is null`;
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
    await withLocalPg(async (sql) => sql`update office_attendance set deleted_at = now() where id = ${id}`);
    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
