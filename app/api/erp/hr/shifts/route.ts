import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrAttendanceLeaveService } from "@/lib/services/hr-attendance-leave-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
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

export async function GET() {
  try {
    const { scope } = await guardHr("read");
    const rows = await hrAttendanceLeaveService.listShifts(scope);
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardHr("write");
    const body = schema.parse(await request.json());
    const res = await hrAttendanceLeaveService.upsertShift(body, null, session.userId, scope);
    return apiCreated({ shift: res });
  } catch (error) {
    return handleApiError(error);
  }
}
