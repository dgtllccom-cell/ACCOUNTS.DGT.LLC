import { NextRequest, NextResponse } from "next/server";
import { requireErpSession, sessionInDomain } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { writeRecordChangeHistory } from "@/lib/api/record-change-history";
import { getCustomerOrderById } from "@/lib/services/clearing-customer-order-service";
import { setOrderApprovalStatus, submitOrderForApproval } from "@/lib/services/clearing-customer-order-approval-service";
import { canAccessOrder } from "@/lib/services/clearing-customer-order-scope";

/**
 * PATCH /api/erp/clearing-agent/customer-order/[id]/approval
 * body: { action: "submit" | "approve" | "reject", reason?: string }
 *
 * Order-level approval gate (Phase 3 of the shipping billing/receipts plan).
 * "submit" moves a booked order into pending_approval; "approve"/"reject" are
 * the gate itself. Scope check reuses canAccessOrder from the sibling [id]
 * route — same authorization surface as GET/PATCH on the order itself.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Customer order id is required" }, { status: 400 });
    }

    const body = await req.json();
    const action = String(body?.action ?? "").trim();
    if (!["submit", "approve", "reject"].includes(action)) {
      return NextResponse.json({ success: false, error: "action must be 'submit', 'approve', or 'reject'" }, { status: 400 });
    }

    authorizeApiScope(session, {
      resource: "shipping_records",
      action: action === "submit" ? "update" : action
    });
    if (!sessionInDomain(session, "shipping")) {
      return NextResponse.json({ success: false, error: "This action requires shipping domain access." }, { status: 403 });
    }

    const existing = await getCustomerOrderById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Customer order not found" }, { status: 404 });
    }
    if (!canAccessOrder(session, existing)) {
      return NextResponse.json({ success: false, error: "Not authorized to act on this order" }, { status: 403 });
    }

    if (action === "submit") {
      if (existing.status !== "booking_confirmed" && existing.status !== "pending") {
        return NextResponse.json({ success: false, error: `Order must be confirmed before submitting for approval (currently: ${existing.status}).` }, { status: 409 });
      }
      await submitOrderForApproval(id, session.userId);
      void writeRecordChangeHistory({
        recordTable: "clearing_customer_orders",
        recordId: id,
        action: "update",
        actorId: session.userId,
        countryId: existing.country_id ?? null,
        cityBranchId: existing.city_branch_id ?? null,
        beforeData: { status: existing.status },
        afterData: { status: "pending_approval" }
      }).catch(() => {});
      return NextResponse.json({ success: true, data: { id, status: "pending_approval" } });
    }

    const result = await setOrderApprovalStatus(id, action as "approve" | "reject", session.userId, body?.reason ?? null);

    void writeRecordChangeHistory({
      recordTable: "clearing_customer_orders",
      recordId: id,
      action: "update",
      actorId: session.userId,
      countryId: existing.country_id ?? null,
      cityBranchId: existing.city_branch_id ?? null,
      beforeData: { status: existing.status },
      afterData: { status: result.status, reason: body?.reason ?? null }
    }).catch(() => {});

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    const status = /not found/i.test(error?.message ?? "") ? 404 : /must be in pending_approval/i.test(error?.message ?? "") ? 409 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
