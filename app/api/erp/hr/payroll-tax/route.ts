import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError } from "@/lib/api/response";
import { guardHr } from "@/lib/services/hr-api";
import { hrPayrollTaxService } from "@/lib/services/hr-payroll-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  countryId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  componentType: z.enum([
    "income_tax", "social_security_employee", "social_security_employer",
    "pension_employee", "pension_employer", "other_employee_deduction", "other_employer_contribution",
  ]),
  payer: z.enum(["employee", "employer"]),
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

export async function GET(request: NextRequest) {
  try {
    const { scope } = await guardHr("read");
    const sp = request.nextUrl.searchParams;
    const rows = await hrPayrollTaxService.list(scope, {
      countryId: sp.get("countryId") || undefined,
      componentType: sp.get("componentType") || undefined,
    });
    return apiOk({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, scope } = await guardHr("write");
    const body = schema.parse(await request.json());
    const res = await hrPayrollTaxService.upsert(body, null, session.userId, scope);
    return apiCreated({ config: res });
  } catch (error) {
    return handleApiError(error);
  }
}
