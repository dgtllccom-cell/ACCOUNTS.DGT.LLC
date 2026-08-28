import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrAttendanceLeaveService } from "@/lib/services/hr-attendance-leave-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  action: z.enum(["initialize", "recompute"]),
  year: z.number().int().min(2000).max(2100),
});

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const rows = await hrAttendanceLeaveService.listBalances(scope, {
      year: sp.get("year") ? Number(sp.get("year")) : undefined,
      employeeId: sp.get("employeeId") || undefined,
      search: sp.get("search")?.trim() || undefined,
    });
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardHr("write");
    const { action, year } = bodySchema.parse(await request.json());
    const res =
      action === "initialize"
        ? await hrAttendanceLeaveService.initializeYear(year, session.userId, scope)
        : await hrAttendanceLeaveService.recomputeBalances(year, scope);
    return apiOk(res);
  } catch (error) {
    return handleApiError(error);
  }
}
