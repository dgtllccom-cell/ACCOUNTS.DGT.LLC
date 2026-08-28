import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrAttendanceLeaveService } from "@/lib/services/hr-attendance-leave-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const patchSchema = z.object({
  code: z.string().trim().max(40).optional(),
  name: z.string().trim().max(120).optional(),
  countryId: z.string().uuid().nullish(),
  countryBranchId: z.string().uuid().nullish(),
  cityBranchId: z.string().uuid().nullish(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  breakMinutes: z.number().int().min(0).max(480).optional(),
  graceMinutes: z.number().int().min(0).max(240).optional(),
  workingDays: z.string().max(60).optional(),
  isNightShift: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const res = await hrAttendanceLeaveService.upsertShift(body, id, session.userId, scope);
    return apiOk({ shift: res });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const res = await hrAttendanceLeaveService.deleteShift(id);
    return apiOk({ deleted: res });
  } catch (error) {
    return handleApiError(error);
  }
}
