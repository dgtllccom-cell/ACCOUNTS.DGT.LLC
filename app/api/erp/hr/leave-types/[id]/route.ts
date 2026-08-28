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
  isPaid: z.boolean().optional(),
  annualEntitlementDays: z.number().min(0).max(366).optional(),
  accrualMethod: z.enum(["annual", "monthly", "none"]).optional(),
  maxCarryForwardDays: z.number().min(0).max(366).optional(),
  requiresDocument: z.boolean().optional(),
  minNoticeDays: z.number().int().min(0).max(365).optional(),
  isActive: z.boolean().optional(),
  rankOrder: z.number().int().optional(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const res = await hrAttendanceLeaveService.upsertLeaveType(body, id, scope);
    return apiOk({ leaveType: res });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const res = await hrAttendanceLeaveService.deleteLeaveType(id);
    return apiOk({ deleted: res });
  } catch (error) {
    return handleApiError(error);
  }
}
