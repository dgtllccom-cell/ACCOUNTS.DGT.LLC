import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { getAccountForCrossBranchAccess, getOwnPostedTransactions } from "@/lib/services/shipping-account-access-service";

/**
 * Account detail for a Shipping Line user: identifying fields for any same-country
 * account, plus only the caller's OWN previously-posted transactions against it — never
 * the account's full ledger/balance history unless it is their own branch or they hold
 * `ledger_full:read` (see shipping-account-access-service.ts).
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    const account = await getAccountForCrossBranchAccess(session, id);
    if (!account) return apiOk({ account: null }, { status: 404 });

    const ownTransactions = await getOwnPostedTransactions(session, { enterpriseAccountId: account.id });

    return apiOk({ account, ownTransactions });
  } catch (error) {
    return handleApiError(error);
  }
}
