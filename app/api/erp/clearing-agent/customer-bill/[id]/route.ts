import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import {
  getCustomerBillById,
  saveCustomerBill
} from "@/lib/services/clearing-customer-bill-service";
import { listCustomerOrders, type CustomerOrderScopeFilter } from "@/lib/services/clearing-customer-order-service";

async function billIsInScope(bill: any, session: any) {
  if (session.isSuperAdmin) return true;
  const scope: CustomerOrderScopeFilter = {
    isSuperAdmin: false,
    countryIds: (session.countryIds ?? []) as string[],
    countryBranchIds: (session.countryBranchIds ?? []) as string[],
    cityBranchIds: (session.cityBranchIds ?? []) as string[],
    clearingAgentIds: (session.clearingAgentIds ?? []) as string[],
    createdByUserId: typeof session.userId === "string" ? session.userId : null
  };
  const visibleOrderIds = new Set((await listCustomerOrders(undefined, scope)).map((order: any) => String(order.id)));
  const linkedOrderIds = Array.isArray(bill.order_ids) && bill.order_ids.length > 0 ? bill.order_ids : [bill.order_id];
  return linkedOrderIds.some((id: unknown) => visibleOrderIds.has(String(id)));
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { id } = await context.params;
    const bill = await getCustomerBillById(id);
    if (!bill) {
      return NextResponse.json({ success: false, error: "Customer bill not found." }, { status: 404 });
    }
    if (!(await billIsInScope(bill, session))) {
      return NextResponse.json({ success: false, error: "Not authorized to view this customer bill." }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: bill });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch customer bill." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    const { id } = await context.params;
    const body = await req.json();
    const existing = await getCustomerBillById(id);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Customer bill not found." }, { status: 404 });
    }
    if (!(await billIsInScope(existing, session))) {
      return NextResponse.json({ success: false, error: "Not authorized to update this customer bill." }, { status: 403 });
    }

    const updated = await saveCustomerBill({
      id,
      orderIds: Array.isArray(body.orderIds)
        ? body.orderIds
        : Array.isArray(body.order_ids)
          ? body.order_ids
          : undefined,
      dueDate: body.dueDate,
      discountAmount: body.discountAmount,
      otherCharges: body.otherCharges,
      remarks: body.remarks,
      items: body.items || [],
      actorId: session.userId
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    console.error("PATCH /api/erp/clearing-agent/customer-bill/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save customer bill." },
      { status: 500 }
    );
  }
}
