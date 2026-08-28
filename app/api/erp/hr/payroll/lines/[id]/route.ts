import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr, canRunPayroll } from "@/lib/services/hr-api";
import { requireErpSession } from "@/lib/auth/session";
import { hrPayrollService } from "@/lib/services/hr-payroll-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  bonusAmount: z.number().min(0).max(10_000_000).optional(),
  otherDeductions: z.number().min(0).max(10_000_000).optional(),
  taxEmployee: z.number().min(0).max(10_000_000).optional(),
  employerContributions: z.number().min(0).max(10_000_000).optional(),
  exclude: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullish(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardHr("write");
    const session = await requireErpSession();
    if (!canRunPayroll(session)) throw new Error("Payroll actions require a payroll or admin role.");
    const { id } = idSchema.parse(await ctx.params);
    const body = bodySchema.parse(await request.json());
    const res = await hrPayrollService.updateLine(id, body, scope);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
