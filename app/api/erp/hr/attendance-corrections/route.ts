import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrAttendanceLeaveService } from "@/lib/services/hr-attendance-leave-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  employeeId: z.string().uuid(),
  attendanceId: z.string().uuid().nullish(),
  attendanceDate: z.string(),
  newCheckIn: z.string().nullish(),
  newCheckOut: z.string().nullish(),
  newStatus: z.string().trim().max(40).nullish(),
  newWorkHours: z.number().min(0).max(24).nullish(),
  reason: z.string().trim().min(1).max(2000),
});

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const rows = await hrAttendanceLeaveService.listCorrections(scope, {
      status: sp.get("status") || undefined,
      employeeId: sp.get("employeeId") || undefined,
    });
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardHr("write");
    const body = schema.parse(await request.json());
    const res = await hrAttendanceLeaveService.createCorrection(body, session.userId, scope);
    return apiCreated({ correction: res });
  } catch (error) {
    return handleApiError(error);
  }
}
