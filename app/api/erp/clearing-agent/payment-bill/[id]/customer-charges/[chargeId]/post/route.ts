import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";
import {
  acquireIdempotencyLock,
  commitIdempotencySuccess,
  releaseIdempotencyLock,
  buildReplayedResponse
} from "@/lib/api/idempotency";
import { postBillCustomerCharge } from "@/lib/services/clearing-bill-customer-charge-service";

/**
 * POST /api/erp/clearing-agent/payment-bill/[id]/customer-charges/[chargeId]/post
 * Books one customer charge through the same posting engine bill-expenses uses
 * (postRoznamchaWithErpSession) — DR customer shipping AR / CR Shipping Revenue.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; chargeId: string }> }) {
  let idemKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "clearing_bill_customer_charges", action: "post" });
    const { id, chargeId } = await params;

    const bill = await withLocalPg((sql) => sql`
      SELECT id, country_id, country_branch_id, city_branch_id FROM public.clearing_payment_bills
      WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
    `);
    if (!bill?.[0]) return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 });
    if (!session.isSuperAdmin && bill[0].country_id && !session.countryIds.includes(bill[0].country_id)) {
      return NextResponse.json({ success: false, error: "This bill is outside your authorized scope." }, { status: 403 });
    }

    const lock = await acquireIdempotencyLock({
      req,
      scopeModule: "CLEARING_BILL_CHARGE_POST",
      userId: session.userId,
      countryId: bill[0].country_id,
      cityBranchId: bill[0].city_branch_id,
      businessReference: chargeId,
      payload: {}
    });
    if (lock.isReplayed) return buildReplayedResponse(lock.responseCode || 200, lock.responseBody);
    if (!lock.acquired) {
      return NextResponse.json({ success: false, error: "This charge is being posted right now. Please wait." }, { status: 409 });
    }
    idemKey = lock.idempotencyKey;
    tenantHash = lock.tenantHash;

    const result = await postBillCustomerCharge(chargeId, session.userId, {
      countryId: bill[0].country_id,
      countryBranchId: bill[0].country_branch_id,
      cityBranchId: bill[0].city_branch_id
    });

    void writeRecordChangeHistory({
      recordTable: "clearing_bill_customer_charges",
      recordId: chargeId,
      action: "update",
      actorId: session.userId,
      countryId: bill[0].country_id ?? null,
      cityBranchId: bill[0].city_branch_id ?? null,
      afterData: { posting_status: "posted", ...result }
    }).catch(() => {});

    const responseBody = { ok: true, ...result };
    await commitIdempotencySuccess(idemKey, tenantHash, 200, responseBody);
    return NextResponse.json({ success: true, data: responseBody });
  } catch (error: any) {
    if (idemKey) await releaseIdempotencyLock(idemKey, tenantHash).catch(() => {});
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
