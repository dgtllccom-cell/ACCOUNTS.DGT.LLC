import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardWps } from "@/lib/services/hr-wps-guard";
import { reconcileWpsPaymentResults } from "@/lib/services/hr-wps-service";

export const dynamic = "force-dynamic";

const idSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  paymentLedgerId: z.string().uuid(),
  paymentDate: z.string().trim().min(1),
  results: z.array(z.object({
    employeeId: z.string().uuid(),
    resultStatus: z.enum(["paid", "rejected"]),
    resultReason: z.string().trim().max(600).nullish(),
    bankReference: z.string().trim().max(120).nullish(),
    amount: z.number().nullish(),
  })).min(1).max(500),
});

/**
 * Real per-employee WPS payment-result reconciliation, loop-back into the
 * payroll run: 'paid' posts the real accounting entry and marks the line
 * paid; 'rejected' marks a real payment_failed exception, no money posted.
 * Duplicate-posting protected (see reconcileWpsPaymentResults).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session } = await guardWps("write");
    const { id } = idSchema.parse(await ctx.params);
    const body = bodySchema.parse(await request.json());
    const result = await reconcileWpsPaymentResults(session, id, body.results, { paymentLedgerId: body.paymentLedgerId, paymentDate: body.paymentDate });
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
