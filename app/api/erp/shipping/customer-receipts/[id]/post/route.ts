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
import { postReceipt } from "@/lib/services/customer-receipt-service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let idemKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customer_receipts", action: "post" });
    const { id } = await params;

    const receipt = await withLocalPg((sql) => sql`
      SELECT id, country_id, country_branch_id, city_branch_id FROM public.customer_receipts
      WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
    `);
    if (!receipt?.[0]) return NextResponse.json({ success: false, error: "Receipt not found" }, { status: 404 });
    if (!session.isSuperAdmin && receipt[0].country_id && !session.countryIds.includes(receipt[0].country_id)) {
      return NextResponse.json({ success: false, error: "This receipt is outside your authorized scope." }, { status: 403 });
    }

    const lock = await acquireIdempotencyLock({
      req,
      scopeModule: "CUSTOMER_RECEIPT_POST",
      userId: session.userId,
      countryId: receipt[0].country_id,
      cityBranchId: receipt[0].city_branch_id,
      businessReference: id,
      payload: {}
    });
    if (lock.isReplayed) return buildReplayedResponse(lock.responseCode || 200, lock.responseBody);
    if (!lock.acquired) {
      return NextResponse.json({ success: false, error: "This receipt is being posted right now. Please wait." }, { status: 409 });
    }
    idemKey = lock.idempotencyKey;
    tenantHash = lock.tenantHash;

    const result = await postReceipt(id, session.userId, {
      countryId: receipt[0].country_id,
      countryBranchId: receipt[0].country_branch_id,
      cityBranchId: receipt[0].city_branch_id
    });

    void writeRecordChangeHistory({
      recordTable: "customer_receipts",
      recordId: id,
      action: "update",
      actorId: session.userId,
      countryId: receipt[0].country_id ?? null,
      cityBranchId: receipt[0].city_branch_id ?? null,
      afterData: { status: "posted", ...result }
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
