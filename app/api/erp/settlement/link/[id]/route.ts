import { NextRequest } from "next/server";
import { apiError, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { settlementService } from "@/lib/services/settlement-service";
import { canAccessCityBranch, canAccessCountryBranch, canAccessCountry } from "@/lib/permissions/middleware";
import type { ErpSession } from "@/lib/auth/session";

function canAccessScope(session: ErpSession, scope: { country_id: string | null; country_branch_id: string | null; city_branch_id: string | null } | null): boolean {
  if (session.isSuperAdmin) return true;
  if (!scope) return false;
  if (scope.city_branch_id) return canAccessCityBranch(session, scope.city_branch_id);
  if (scope.country_branch_id) return canAccessCountryBranch(session, scope.country_branch_id);
  if (scope.country_id) return canAccessCountry(session, scope.country_id);
  return false;
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id: linkId } = await context.params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason") || undefined;

    if (!linkId) {
      return handleApiError(new Error("Link ID is required"));
    }

    const linkScope = await settlementService.getLinkScope(linkId);
    if (!canAccessScope(session, linkScope.cr) || !canAccessScope(session, linkScope.dr)) {
      return apiError("FORBIDDEN", "This settlement link is outside your assigned scope.", 403);
    }

    await settlementService.removeLink({
      linkId,
      actorId: session.userId,
      reason
    });

    return apiOk({ success: true, message: "Settlement link removed" });
  } catch (error) {
    return handleApiError(error);
  }
}
