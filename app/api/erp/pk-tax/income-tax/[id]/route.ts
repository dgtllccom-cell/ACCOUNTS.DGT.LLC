import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardPkTax } from "@/lib/services/pk-tax-api";
import { getReturn, updateWorking } from "@/lib/services/pk-income-tax-service";

export const dynamic = "force-dynamic";
const idSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await guardPkTax("read");
    const { id } = idSchema.parse(await ctx.params);
    return apiOk(await getReturn(scope, id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** Taxable-income working. Recomputes tax and CLEARS accountant_confirmed (must be re-confirmed after any edit). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardPkTax("write");
    const { id } = idSchema.parse(await ctx.params);
    const b = z.object({
      taxableIncome: z.number().nullish(),
      taxableIncomeSource: z.string().trim().max(300).nullish(),
      turnover: z.number().min(0).nullish(),
      superTaxIncome: z.number().min(0).nullish(),
      superTaxAmount: z.number().min(0).optional(),
      companyType: z.enum(["small", "banking", "other"]).optional(),
      ntn: z.string().trim().nullish(),
      notes: z.string().trim().max(4000).nullish(),
      responsibleUserId: z.string().uuid().nullish(),
    }).parse(await request.json());
    return apiOk(await updateWorking(session, scope, id, b));
  } catch (error) {
    return handleApiError(error);
  }
}
