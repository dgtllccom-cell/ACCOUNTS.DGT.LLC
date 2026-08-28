import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { guardHr, canRunPayroll } from "@/lib/services/hr-api";
import { requireErpSession } from "@/lib/auth/session";
import { hrPayrollService } from "@/lib/services/hr-payroll-service";
import { hrPayrollPosting } from "@/lib/services/hr-payroll-posting";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  action: z.enum(["calculate", "review", "approve", "cancel", "recompute", "post", "pay", "reverse"]),
  taxPayableLedgerId: z.string().uuid().nullish(),
  paymentLedgerId: z.string().uuid().nullish(),
  paymentDate: z.string().nullish(),
  reason: z.string().trim().max(2000).nullish(),
});

export async function GET(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardHr("read");
    const { id } = idSchema.parse(await ctx.params);
    const data = await hrPayrollService.getRun(id, scope);
    if (!data) return apiError("NOT_FOUND", "Payroll run not found in your scope.", 404);
    return apiOk(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardHr("write");
    const session = await requireErpSession();
    if (!canRunPayroll(session)) throw new Error("Payroll actions require a payroll or admin role.");
    const { id } = idSchema.parse(await ctx.params);
    const body = bodySchema.parse(await request.json());
    const actorName = session.fullName ?? null;

    let res: unknown;
    switch (body.action) {
      case "calculate":
        res = await hrPayrollService.calculate(id, session.userId, actorName, scope);
        break;
      case "recompute":
        res = await hrPayrollService.recomputeTotals(id, scope);
        break;
      case "review":
      case "approve":
      case "cancel":
        res = await hrPayrollService.setStatus(id, body.action, session.userId, actorName, scope);
        break;
      case "post":
        res = await hrPayrollPosting.post(id, { taxPayableLedgerId: body.taxPayableLedgerId ?? null }, session.userId, actorName, scope);
        break;
      case "pay":
        if (!body.paymentLedgerId || !body.paymentDate) throw new Error("paymentLedgerId and paymentDate are required to mark a run Paid.");
        res = await hrPayrollPosting.markPaid(id, { paymentLedgerId: body.paymentLedgerId, paymentDate: body.paymentDate }, session.userId, actorName, scope);
        break;
      case "reverse":
        res = await hrPayrollPosting.reverse(id, body.reason ?? "Payroll reversal", session.userId, actorName, scope);
        break;
    }
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
