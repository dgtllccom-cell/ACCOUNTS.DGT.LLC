import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax", action: "read" });
    const ruleType = new URL(request.url).searchParams.get("ruleType") || undefined;
    const rules = await uaeTaxService.listRules(ruleType);
    return apiOk({ rules });
  } catch (error) {
    return handleApiError(error);
  }
}
