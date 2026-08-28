import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrAttendanceLeaveService } from "@/lib/services/hr-attendance-leave-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const patchSchema = z.object({
  name: z.string().trim().max(160).optional(),
  holidayDate: z.string().optional(),
  countryId: z.string().uuid().nullish(),
  countryBranchId: z.string().uuid().nullish(),
  cityBranchId: z.string().uuid().nullish(),
  holidayType: z.enum(["public", "religious", "national", "company", "weekly_off"]).optional(),
  isRecurring: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  notes: z.string().trim().max(1000).nullish(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const res = await hrAttendanceLeaveService.upsertHoliday(body, id, session.userId, scope);
    return apiOk({ holiday: res });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const res = await hrAttendanceLeaveService.deleteHoliday(id);
    return apiOk({ deleted: res });
  } catch (error) {
    return handleApiError(error);
  }
}
