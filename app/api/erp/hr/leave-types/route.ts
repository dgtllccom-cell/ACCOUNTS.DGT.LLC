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
  isPaid: z.boolean().optional(),
  annualEntitlementDays: z.number().min(0).max(366).optional(),
  accrualMethod: z.enum(["annual", "monthly", "none"]).optional(),
  maxCarryForwardDays: z.number().min(0).max(366).optional(),
  requiresDocument: z.boolean().optional(),
  minNoticeDays: z.number().int().min(0).max(365).optional(),
  isActive: z.boolean().optional(),
  rankOrder: z.number().int().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const rows = await hrAttendanceLeaveService.listLeaveTypes(scope, request.nextUrl.searchParams.get("activeOnly") === "1");
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { scope } = await guardHr("write");
    const body = schema.parse(await request.json());
    const res = await hrAttendanceLeaveService.upsertLeaveType(body, null, scope);
    return apiCreated({ leaveType: res });
  } catch (error) {
    return handleApiError(error);
  }
}
