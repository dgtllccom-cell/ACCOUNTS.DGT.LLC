import type { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { uaeTaxService } from "@/lib/services/uae-tax-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Pull taxable lines from the existing ERP source modules into uae_tax_lines.
 * The actual sync SQL functions land in Phase 2 — this endpoint exists now so
 * the UI wiring is stable.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "uae_tax", action: "write" });

    const body = (await request.json().catch(() => ({}))) as {
      fromDate?: string | null;
      taxEntityId?: string | null;
    };

    const result = await uaeTaxService.syncFromErp({
      fromDate: body.fromDate ?? null,
      taxEntityId: body.taxEntityId ?? null,
    });
    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
