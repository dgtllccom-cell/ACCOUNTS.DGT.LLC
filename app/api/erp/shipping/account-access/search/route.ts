import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { searchSameCountryAccounts } from "@/lib/services/shipping-account-access-service";

const querySchema = z.object({
  q: z.string().trim().min(1).max(200),
  countryId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

/**
 * Same-country, cross-branch Account Master search for a Shipping Line user.
 * Gated on the existing `accounts:read` permission (independently grantable via the
 * Permission Control Center); results are stripped to identifying fields only unless
 * the account is in the caller's own branch or they hold `ledger_full:read`.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    const accounts = await searchSameCountryAccounts(session, {
      query: query.q,
      countryId: query.countryId,
      limit: query.limit
    });

    return apiOk({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
}
