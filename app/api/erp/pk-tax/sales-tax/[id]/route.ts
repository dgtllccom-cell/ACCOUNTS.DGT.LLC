import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardPkTax } from "@/lib/services/pk-tax-api";
import { getReturn, updateWorking } from "@/lib/services/pk-sales-tax-service";

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

/** Output/input tax working. Recomputes net_payable and CLEARS accountant_confirmed (must be re-confirmed after any edit). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardPkTax("write");
    const { id } = idSchema.parse(await ctx.params);
    const b = z.object({
      outputTaxAmount: z.number().min(0).nullish(),
      outputTaxSource: z.string().trim().max(300).nullish(),
      inputTaxAmount: z.number().min(0).nullish(),
      inputTaxSource: z.string().trim().max(300).nullish(),
      strn: z.string().trim().nullish(),
      notes: z.string().trim().max(4000).nullish(),
      responsibleUserId: z.string().uuid().nullish(),
    }).parse(await request.json());
    return apiOk(await updateWorking(session, scope, id, b));
  } catch (error) {
    return handleApiError(error);
  }
}
