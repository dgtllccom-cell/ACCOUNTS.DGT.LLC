import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, handleApiError } from "@/lib/api/response";
import { guardHr, canRunPayroll } from "@/lib/services/hr-api";
import { requireErpSession } from "@/lib/auth/session";
import { hrGratuityService } from "@/lib/services/hr-gratuity-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  action: z.enum(["approve", "cancel", "pay"]),
  expenseLedgerId: z.string().uuid().nullish(),
  paymentLedgerId: z.string().uuid().nullish(),
  paymentDate: z.string().nullish(),
});

export async function GET(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardHr("read");
    const { id } = idSchema.parse(await ctx.params);
    const row = await hrGratuityService.get(id, scope);
    if (!row) return apiError("NOT_FOUND", "Settlement not found in your scope.", 404);
    return apiOk({ settlement: row });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardHr("write");
    const session = await requireErpSession();
    if (!canRunPayroll(session)) throw new Error("Final settlement actions require a payroll or admin role.");
    const { id } = idSchema.parse(await ctx.params);
    const body = bodySchema.parse(await request.json());
    if (body.action === "pay") {
      if (!body.paymentLedgerId || !body.paymentDate) throw new Error("paymentLedgerId and paymentDate are required.");
      const res = await hrGratuityService.pay(id, { expenseLedgerId: body.expenseLedgerId ?? null, paymentLedgerId: body.paymentLedgerId, paymentDate: body.paymentDate }, session.userId, scope);
      return apiOk({ result: res });
    }
    const res = await hrGratuityService.setStatus(id, body.action, session.userId, scope);
    return apiOk({ result: res });
  } catch (error) {
    return handleApiError(error);
  }
}
