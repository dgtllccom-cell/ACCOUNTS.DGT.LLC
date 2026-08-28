import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uaeTaxService } from "@/lib/services/uae-tax-service";
import { uaeTaxScopeFromSession } from "@/lib/services/uae-tax-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchSchema = z.object({
  companyId: z.string().uuid().nullish(),
  trn: z.string().trim().min(5).max(30).optional(),
  legalName: z.string().trim().min(2).max(200).optional(),
  registeredName: z.string().trim().max(200).nullish(),
  registrationDate: z.string().nullish(),
  filingFrequency: z.enum(["monthly", "quarterly"]).optional(),
  firstPeriodStart: z.string().nullish(),
  baseCurrency: z.string().trim().length(3).optional(),
  address: z.string().trim().max(500).nullish(),
  phone: z.string().trim().max(50).nullish(),
  email: z.string().trim().max(200).nullish(),
  isActive: z.boolean().optional(),
  effectiveTo: z.string().nullish(),
  branches: z
    .array(z.object({ countryBranchId: z.string().uuid().nullish(), cityBranchId: z.string().uuid().nullish() }))
    .optional(),
});

const CAMEL_TO_SNAKE: Record<string, string> = {
  companyId: "company_id",
  trn: "trn",
  legalName: "legal_name",
  registeredName: "registered_name",
  registrationDate: "registration_date",
  filingFrequency: "filing_frequency",
  firstPeriodStart: "first_period_start",
  baseCurrency: "base_currency",
  address: "address",
  phone: "phone",
  email: "email",
  isActive: "is_active",
  effectiveTo: "effective_to",
};

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax", action: "read" });
    const { id } = await ctx.params;
    const entity = await uaeTaxService.getEntity(id, uaeTaxScopeFromSession(session));
    if (!entity) return apiError("NOT_FOUND", "Tax entity not found", 404);
    return apiOk({ entity });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax_settings", action: "write" });
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const scope = uaeTaxScopeFromSession(session);

    const patch: Record<string, unknown> = {};
    for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
      if (camel in body) patch[snake] = (body as Record<string, unknown>)[camel];
    }
    if (Object.keys(patch).length) {
      await uaeTaxService.updateEntity(id, patch, scope);
    }
    if (body.branches) {
      await uaeTaxService.setEntityBranches(id, body.branches, session.userId);
    }

    const entity = await uaeTaxService.getEntity(id, scope);
    return apiOk({ entity });
  } catch (error) {
    return handleApiError(error);
  }
}
