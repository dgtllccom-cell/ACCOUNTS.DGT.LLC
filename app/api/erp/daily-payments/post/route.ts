import { NextRequest } from "next/server";
import { z } from "zod";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";
import { postCanonicalDailyPayment, CanonicalDailyPaymentInput } from "@/lib/services/canonical-daily-payment-posting-service";

const dailyPaymentPostSchema = z.object({
  targetType: z.enum(["purchase_booking", "local_purchase", "sales_booking", "local_sales"]),
  targetId: z.string().uuid(),
  direction: z.enum(["purchase_payment", "sales_payment"]),
  condition: z.enum(["advance", "endorsement", "credit", "remaining", "final"]),
  method: z.enum(["cash", "bank_transfer", "tt_swift", "mobile_wallet", "cheque", "internal_transfer"]),
  entryDate: z.string().min(8),
  amount: z.coerce.number().positive(),
  currencyCode: z.string().min(1).default("USD"),
  exchangeRate: z.coerce.number().positive().default(1),
  debitLedgerId: z.string().uuid(),
  creditLedgerId: z.string().uuid(),
  referenceNo: z.string().optional().nullable(),
  narration: z.string().optional().nullable(),
  methodDetails: z.record(z.string(), z.unknown()).optional().nullable(),
  receiptAttachmentUrl: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  let idempotencyKey = "";
  let tenantHash = "";

  try {
    const session = await requireErpSession();

    let rawBody: any;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const payloadStr = formData.get("payload");
      if (!payloadStr) throw new Error("Missing payload in multipart request.");
      rawBody = JSON.parse(String(payloadStr));
    } else {
      rawBody = await request.json();
    }

    const body = dailyPaymentPostSchema.parse(rawBody);

    // Acquire idempotency lock to prevent double-click / duplicate submission
    const lockRes = await acquireIdempotencyLock({
      req: request,
      scopeModule: "DAILY_PAYMENT",
      userId: session.userId,
      countryId: session.countryIds?.[0] ?? null,
      cityBranchId: session.cityBranchIds?.[0] ?? null,
      businessReference: `${body.direction}_${body.targetId}_${body.condition}`,
      payload: body,
    });

    if (lockRes.isReplayed) {
      return buildReplayedResponse(lockRes.responseCode || 201, lockRes.responseBody);
    }
    if (!lockRes.acquired) {
      return handleApiError(new Error("A payment request is already being processed for this order. Please wait."));
    }

    idempotencyKey = lockRes.idempotencyKey;
    tenantHash = lockRes.tenantHash;

    // Check scope authorization
    authorizeApiScope(session, {
      resource: body.direction === "purchase_payment" ? "purchases" : "sales",
      action: "post",
    });

    const result = await postCanonicalDailyPayment(body as CanonicalDailyPaymentInput, {
      userId: session.userId,
      countryIds: session.countryIds,
      cityBranchIds: session.cityBranchIds,
    });

    await commitIdempotencySuccess(idempotencyKey, tenantHash, 201, result);
    return apiCreated(result);
  } catch (error) {
    if (idempotencyKey) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash).catch(() => {});
    }
    return handleApiError(error);
  }
}
