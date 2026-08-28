import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { assertUaeCountryAccess } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";
import { uaeTaxScopeFromSession } from "@/lib/services/uae-tax-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchSchema = z.object({
  recoverability: z.enum(["recoverable", "partial", "non_recoverable", "pending_review"]).optional(),
  recoverableAmount: z.number().nonnegative().optional(),
  taxCategory: z.enum(["standard", "zero_rated", "exempt", "reverse_charge", "out_of_scope", "deemed_supply"]).optional(),
  transactionCategory: z
    .enum([
      "daily_expense", "local_purchase", "local_sale", "booking_purchase", "booking_sale",
      "import", "export", "re_export", "free_zone", "designated_zone",
      "own_goods_transfer", "stock_transfer", "other",
    ])
    .optional(),
  reviewStatus: z.enum(["auto", "confirmed", "needs_review", "excluded"]).optional(),
  taxCodeId: z.string().uuid().nullable().optional(),
});

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax", action: "read" });
    await assertUaeCountryAccess(session);
    const { id } = await ctx.params;
    const line = await uaeTaxService.getLine(id, uaeTaxScopeFromSession(session));
    if (!line) return apiError("NOT_FOUND", "Tax line not found", 404);
    return apiOk({ line, sourceLink: uaeTaxService.sourceLink(line) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax", action: "write" });
    await assertUaeCountryAccess(session);
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const scope = uaeTaxScopeFromSession(session);
    await uaeTaxService.updateLineClassification(id, body, scope);
    const line = await uaeTaxService.getLine(id, scope);
    return apiOk({ line });
  } catch (error) {
    return handleApiError(error);
  }
}
