import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardHr, canRunPayroll } from "@/lib/services/hr-api";
import { requireErpSession } from "@/lib/auth/session";
import { hrPayrollService } from "@/lib/services/hr-payroll-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const createSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
  countryId: z.string().uuid().nullish(),
  countryBranchId: z.string().uuid().nullish(),
  cityBranchId: z.string().uuid().nullish(),
  presentationCurrency: z.string().trim().max(8).optional(),
  notes: z.string().trim().max(2000).nullish(),
});

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const rows = await hrPayrollService.listRuns(scope, {
      status: sp.get("status") || undefined,
      periodMonth: sp.get("periodMonth") || undefined,
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
    if (!canRunPayroll(session)) throw new Error("Payroll runs require a payroll or admin role.");
    const body = createSchema.parse(await request.json());
    const res = await hrPayrollService.createRun(body, session.userId, session.fullName ?? null, scope);
    return apiCreated({ run: res });
  } catch (error) {
    return handleApiError(error);
  }
}
