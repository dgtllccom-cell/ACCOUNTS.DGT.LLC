import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrPayrollTaxService } from "@/lib/services/hr-payroll-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const idSchema = z.object({ id: z.string().uuid() });
const patchSchema = z.object({
  countryId: z.string().uuid().optional(),
  name: z.string().trim().max(160).optional(),
  componentType: z.string().optional(),
  payer: z.enum(["employee", "employer"]).optional(),
  calcMethod: z.enum(["flat_percent", "fixed_amount", "slab"]).optional(),
  appliesTo: z.enum(["gross", "basic", "taxable"]).optional(),
  ratePercent: z.number().min(0).max(100).optional(),
  fixedAmount: z.number().min(0).optional(),
  slabs: z.array(z.object({ up_to: z.number(), percent: z.number(), plus_fixed: z.number().optional() })).optional(),
  monthlyExemption: z.number().min(0).optional(),
  annualExemption: z.number().min(0).optional(),
  currency: z.string().trim().max(8).optional(),
  ledgerId: z.string().uuid().nullish(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().nullish(),
  filingFrequency: z.enum(["monthly", "quarterly", "annual"]).optional(),
  isActive: z.boolean().optional(),
  sourceReference: z.string().trim().max(500).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const body = patchSchema.parse(await request.json());
    const res = await hrPayrollTaxService.upsert(body as never, id, session.userId, scope);
    return apiOk({ config: res });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_r: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { session, scope } = await guardHr("write");
    const { id } = idSchema.parse(await ctx.params);
    const res = await hrPayrollTaxService.remove(id, session.userId, scope);
    return apiOk({ deleted: res });
  } catch (error) {
    return handleApiError(error);
  }
}
