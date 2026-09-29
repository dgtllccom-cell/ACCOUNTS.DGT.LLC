import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardUaeTax } from "@/lib/services/uae-tax-api";
import { getReturn, updateWorking } from "@/lib/services/uae-corporate-tax-service";

export const dynamic = "force-dynamic";
const idSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardUaeTax("read");
    const { id } = idSchema.parse(await ctx.params);
    return apiOk(await getReturn(scope, id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Taxable-income working: accounting profit, adjustments, reliefs, losses. Recomputes the tax. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardUaeTax("write");
    const { id } = idSchema.parse(await ctx.params);
    const b = z.object({
      accountingProfit: z.number().nullish(),
      accountingProfitSource: z.string().trim().max(300).nullish(),
      revenue: z.number().min(0).nullish(),
      smallBusinessRelief: z.boolean().optional(),
      qualifyingFreeZone: z.boolean().optional(),
      qualifyingIncome: z.number().min(0).optional(),
      taxLossesBroughtForward: z.number().min(0).optional(),
      ctTrn: z.string().trim().nullish(),
      notes: z.string().trim().max(4000).nullish(),
      responsibleUserId: z.string().uuid().nullish(),
      adjustments: z.array(z.object({
        category: z.enum(["add_back", "deduction", "exempt_income"]),
        description: z.string().trim().max(300),
        amount: z.number().min(0),
        reference: z.string().trim().max(120).nullish(),
      })).max(100).optional(),
    }).parse(await request.json());
    return apiOk(await updateWorking(session, scope, id, b));
  } catch (error) {
    return handleApiError(error);
  }
}
