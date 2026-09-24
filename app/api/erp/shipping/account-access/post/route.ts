import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/posting";
import { canPostCrossBranch, getAccountForCrossBranchAccess } from "@/lib/services/shipping-account-access-service";

const bodySchema = z.object({
  countryId: z.string().uuid(),
  countryBranchId: z.string().uuid().optional().nullable(),
  cityBranchId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid(),
  paymentEntryType: z.enum(["debit", "credit"]),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().length(3),
  exchangeRate: z.coerce.number().positive().default(1),
  entryDate: z.string().date(),
  description: z.string().max(2000).optional(),
  referenceNo: z.string().max(120).optional()
});

function serial(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Shipping Line cross-branch DR/CR posting: the counterpart to the existing
 * `/api/erp/roznamcha` route, which deliberately rejects shipping/agent branches
 * (assertBusinessCityBranch — Roznamcha is a business ledger there). This route is the
 * shipping-domain equivalent: it targets an enterprise_accounts row already tagged
 * operational_domain 'shipping'/'both' and posts through the SAME canonical engine
 * (postRoznamchaWithErpSession, posting.ts) so the transaction is byte-for-byte a real
 * roznamcha_entries/roznamcha_lines row — no parallel ledger.
 *
 * Gated on `roznamcha:post_cross_branch` (or super admin). The country match is enforced
 * again here (defence in depth) and unconditionally inside posting.ts itself.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!canPostCrossBranch(session)) {
      throw new ApiClientError("Missing permission: roznamcha:post_cross_branch", { status: 403 });
    }

    const body = bodySchema.parse(await request.json());

    const account = await getAccountForCrossBranchAccess(session, body.accountId);
    if (!account) throw new ApiClientError("Account not found.", { status: 404 });
    if (!account.ledgerId) throw new ApiClientError("This account has no active ledger to post against.", { status: 400 });
    if (!session.isSuperAdmin && account.countryId !== body.countryId) {
      throw new ApiClientError("Account country does not match the posting country.", { status: 400 });
    }
    if (account.operationalDomain !== "shipping" && account.operationalDomain !== "both") {
      throw new ApiClientError("This account is not part of the Shipping operational domain.", { status: 400 });
    }

    const isDebit = body.paymentEntryType === "debit";

    const result = await postRoznamchaWithErpSession({
      sessionUserId: session.userId,
      session,
      body: {
        mode: "post",
        countryId: body.countryId,
        countryBranchId: body.countryBranchId ?? null,
        cityBranchId: body.cityBranchId ?? null,
        type: "branch",
        entryDate: body.entryDate,
        journalNo: serial("SHPJ"),
        voucherNo: serial("SHPV"),
        referenceNo: body.referenceNo ?? null,
        narration: body.description ?? null,
        roznamchaCategory: "shipping",
        operationalDomain: "shipping",
        originalLanguage: session.preferredLanguage ?? "en",
        lines: [
          {
            ledgerId: account.ledgerId,
            enterpriseAccountId: account.id,
            paymentEntryType: body.paymentEntryType,
            description: body.description ?? null,
            debit: isDebit ? body.amount : 0,
            credit: isDebit ? 0 : body.amount,
            currency: body.currency.toUpperCase(),
            exchangeRate: body.exchangeRate
          }
        ]
      } as any
    });

    return apiOk({ entryId: result?.entryId ?? null, account }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
