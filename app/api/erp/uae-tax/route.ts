import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { assertUaeCountryAccess } from "@/lib/services/uae-tax-api";
import { uaeTaxService } from "@/lib/services/uae-tax-service";
import { uaeTaxScopeFromSession } from "@/lib/services/uae-tax-scope";
import type { UaeTaxLineFilters } from "@/features/uae-tax/types/uae-tax";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax", action: "read" });
    await assertUaeCountryAccess(session);

    const p = new URL(request.url).searchParams;
    const filters: UaeTaxLineFilters = {
      taxEntityId: p.get("taxEntityId") || undefined,
      countryId: p.get("countryId") || undefined,
      countryBranchId: p.get("countryBranchId") || undefined,
      cityBranchId: p.get("cityBranchId") || undefined,
      periodId: p.get("periodId") || undefined,
      direction: (p.get("direction") as UaeTaxLineFilters["direction"]) || undefined,
      transactionCategory: (p.get("transactionCategory") as UaeTaxLineFilters["transactionCategory"]) || undefined,
      taxCategory: (p.get("taxCategory") as UaeTaxLineFilters["taxCategory"]) || undefined,
      recoverability: (p.get("recoverability") as UaeTaxLineFilters["recoverability"]) || undefined,
      documentStatus: (p.get("documentStatus") as UaeTaxLineFilters["documentStatus"]) || undefined,
      party: p.get("party") || undefined,
      currency: p.get("currency") || undefined,
      fromDate: p.get("fromDate") || undefined,
      toDate: p.get("toDate") || undefined,
      search: p.get("search") || undefined,
      limit: p.get("limit") ? Number(p.get("limit")) : undefined,
      offset: p.get("offset") ? Number(p.get("offset")) : undefined,
    };

    const result = await uaeTaxService.listLines(filters, uaeTaxScopeFromSession(session));
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
