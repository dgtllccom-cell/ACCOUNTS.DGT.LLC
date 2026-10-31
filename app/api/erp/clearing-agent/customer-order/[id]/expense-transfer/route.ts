import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { getCustomerOrderById } from "@/lib/services/clearing-customer-order-service";
import { canAccessOrder } from "@/lib/services/clearing-customer-order-scope";
import { httpStatusOfError } from "@/lib/services/clearing-customer-order-workflow-rules";
import {
  EXPENSE_TRANSFER_DESTINATIONS,
  listOrderTransfers,
  recordExpenseTransfer,
} from "@/lib/services/clearing-order-expense-transfer";

export const dynamic = "force-dynamic";

/**
 * Customer Order Transfer (Order Transfer screen) — the persisted record of an order being transferred to an expense bill desk
 * (Customs / Truck / Customer / Other) or received at the Clearing Agent General Received Bills desk.
 * GET: the order's transfer history. POST: record one transfer. Both open the order through the same scope rule as the order API.
 */
const bodySchema = z.object({
  destination: z.enum(EXPENSE_TRANSFER_DESTINATIONS),
  assignedUserId: z.string().uuid().nullish(),
  assignedUser: z.string().trim().max(200).nullish(),
  assignedBranch: z.string().trim().max(200).nullish(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  memo: z.string().trim().max(1000).nullish(),
  routingStage: z.string().trim().max(60).nullish(),
});

async function openOrder(id: string, session: any) {
  const order = await getCustomerOrderById(id);
  if (!order) return { error: NextResponse.json({ success: false, error: "Customer order not found" }, { status: 404 }) };
  if (!canAccessOrder(session, order)) return { error: NextResponse.json({ success: false, error: "Not authorized to open this order" }, { status: 403 }) };
  return { order };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { id } = await params;
    const opened = await openOrder(id, session);
    if (opened.error) return opened.error;
    return NextResponse.json({ success: true, data: await listOrderTransfers(id) });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: httpStatusOfError(error) });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    // the same rule as editing the order (a transfer changes where the order is being worked)
    if (!hasRolePermission(session, "shipping_records", "update") && !hasRolePermission(session, "clearing_orders", "update")) {
      authorizeApiScope(session, { resource: "shipping_records", action: "update" });
    }
    const { id } = await params;
    const opened = await openOrder(id, session);
    if (opened.error) return opened.error;
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid transfer", code: "INVALID_TRANSFER" }, { status: 400 });
    }
    const order = opened.order as any;
    const b = parsed.data;
    const record = await recordExpenseTransfer({
      order: { id: order.id, order_no: order.order_no, country_id: order.country_id, country_branch_id: order.country_branch_id, city_branch_id: order.city_branch_id },
      actorId: session.userId ?? null,
      destination: b.destination,
      assignedUserId: b.assignedUserId ?? null,
      assignedUser: b.assignedUser ?? null,
      assignedBranch: b.assignedBranch ?? null,
      recordedByName: session.fullName || session.email || null,
      date: b.date ?? null,
      memo: b.memo ?? null,
      routingStage: b.routingStage ?? null,
    });
    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: httpStatusOfError(error) });
  }
}
