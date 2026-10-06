import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { hasRolePermission, ErpPermissionError } from "@/lib/permissions/middleware";
import { getAccountStatement } from "@/lib/services/shipping-account-access-service";

/**
 * Account statement with running balance. `mode: "full"` (own branch, country/main-branch
 * roles, Super Admin, or a login granted `ledger_full:read`) returns the complete authorised
 * DR/CR history; otherwise only the caller's own postings are returned. Shipping-only logins
 * never receive Business-domain lines of a shared account.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    if (!hasRolePermission(session, "accounts", "read")) throw new ErpPermissionError("Missing permission: accounts:read");
    const { id } = await context.params;
    const sp = request.nextUrl.searchParams;
    const statement = await getAccountStatement(session, {
      enterpriseAccountId: id,
      from: sp.get("from"),
      to: sp.get("to")
    });
    if (!statement) return apiOk({ statement: null }, { status: 404 });
    return apiOk({ statement });
  } catch (error) {
    return handleApiError(error);
  }
}
