import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrAttendanceLeaveService } from "@/lib/services/hr-attendance-leave-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ action: z.enum(["approve", "reject", "apply"]) });

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const { action } = bodySchema.parse(await request.json());
    const res = await hrAttendanceLeaveService.setCorrectionStatus(id, action, session.userId, scope);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
