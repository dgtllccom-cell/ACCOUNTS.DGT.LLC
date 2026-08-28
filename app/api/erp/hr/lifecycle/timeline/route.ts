import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrLifecycleService } from "@/lib/services/hr-lifecycle-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const qSchema = z.object({ employeeId: z.string().uuid() });

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const { employeeId } = qSchema.parse({ employeeId: request.nextUrl.searchParams.get("employeeId") });
    const rows = await hrLifecycleService.timeline(employeeId, scope);
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}
