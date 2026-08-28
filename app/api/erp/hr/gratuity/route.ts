import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardHr, canRunPayroll } from "@/lib/services/hr-api";
import { requireErpSession } from "@/lib/auth/session";
import { hrGratuityService } from "@/lib/services/hr-gratuity-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const calcSchema = z.object({
  employeeId: z.string().uuid(),
  separationId: z.string().uuid().nullish(),
  calcAsOf: z.string().optional(),
  pendingSalaryAmount: z.number().min(0).optional(),
  noticePayAmount: z.number().min(0).optional(),
  otherAdditions: z.number().min(0).optional(),
  otherDeductions: z.number().min(0).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const rows = await hrGratuityService.list(scope, {
      status: sp.get("status") || undefined,
      search: sp.get("search")?.trim() || undefined,
    });
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { scope } = await guardHr("write");
    const session = await requireErpSession();
    if (!canRunPayroll(session)) throw new Error("Final settlement requires a payroll or admin role.");
    const body = calcSchema.parse(await request.json());
    const res = await hrGratuityService.calculate(body, session.userId, scope);
    return apiCreated({ settlement: res });
  } catch (error) {
    return handleApiError(error);
  }
}
