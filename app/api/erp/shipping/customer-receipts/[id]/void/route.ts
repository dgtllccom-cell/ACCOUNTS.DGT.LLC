import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";

/**
 * POST /api/erp/shipping/customer-receipts/[id]/void
 * A draft (never-posted) receipt can be voided outright. A posted receipt's
 * underlying roznamcha entry is never modified here — reversing a real
 * posting is a separate, deliberate accounting action outside this pass's
 * scope; this route only blocks new activity on the receipt row itself.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customer_receipts", action: "post" });
    const { id } = await params;

    const existing = await withLocalPg((sql) => sql`
      SELECT id, status, country_id, city_branch_id FROM public.customer_receipts WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
    `);
    if (!existing?.[0]) return NextResponse.json({ success: false, error: "Receipt not found" }, { status: 404 });
    if (!session.isSuperAdmin && existing[0].country_id && !session.countryIds.includes(existing[0].country_id)) {
      return NextResponse.json({ success: false, error: "This receipt is outside your authorized scope." }, { status: 403 });
    }
    if (existing[0].status === "posted") {
      return NextResponse.json({ success: false, error: "A posted receipt cannot be voided directly — reverse its ledger entry first." }, { status: 409 });
    }

    await withLocalPg((sql) => sql`
      UPDATE public.customer_receipts SET status = 'void', updated_at = now() WHERE id = ${id}
    `);

    void writeRecordChangeHistory({
      recordTable: "customer_receipts",
      recordId: id,
      action: "update",
      actorId: session.userId,
      countryId: existing[0].country_id ?? null,
      cityBranchId: existing[0].city_branch_id ?? null,
      beforeData: { status: existing[0].status },
      afterData: { status: "void" }
    }).catch(() => {});

    return NextResponse.json({ success: true, data: { id, status: "void" } });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
