import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uaeTaxService } from "@/lib/services/uae-tax-service";
import { uaeTaxScopeFromSession } from "@/lib/services/uae-tax-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax", action: "read" });
    const taxEntityId = new URL(request.url).searchParams.get("taxEntityId") || undefined;
    const periods = await uaeTaxService.listPeriods(taxEntityId, uaeTaxScopeFromSession(session));
    return apiOk({ periods });
  } catch (error) {
    return handleApiError(error);
  }
}
