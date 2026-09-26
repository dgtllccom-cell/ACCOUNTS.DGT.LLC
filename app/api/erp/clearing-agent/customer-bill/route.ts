import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import {
  listCustomerBills,
  ensureCustomerBillForOrders,
  getCustomerBillByOrderId
} from "@/lib/services/clearing-customer-bill-service";
import { listCustomerOrders, type CustomerOrderScopeFilter } from "@/lib/services/clearing-customer-order-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    if (orderId) {
      const bill = await getCustomerBillByOrderId(orderId);
      if (bill && !session.isSuperAdmin) {
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
        if (!linkedOrderIds.some((id) => visibleOrderIds.has(String(id)))) {
          return NextResponse.json({ success: false, error: "Not authorized to view this customer bill." }, { status: 403 });
        }
      }
      return NextResponse.json({ success: true, data: bill });
    }

    const bills = await listCustomerBills({
      orderId: orderId ?? undefined,
      customerId: customerId ?? undefined,
      status: status ?? undefined,
      search: search ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) || undefined : undefined,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) || undefined : undefined,
      isSuperAdmin: !!session.isSuperAdmin,
      countryIds: session.countryIds ?? [],
      countryBranchIds: session.countryBranchIds ?? [],
      cityBranchIds: session.cityBranchIds ?? [],
      clearingAgentIds: session.clearingAgentIds ?? [],
      createdByUserId: session.userId ?? null
    });

    return NextResponse.json({ success: true, data: bills });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    console.error("GET /api/erp/clearing-agent/customer-bill error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch customer bills." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "create" });
    const body = await req.json();
    const orderIds: string[] = Array.from(new Set<string>(
      (Array.isArray(body.orderIds) ? body.orderIds : [body.orderId])
        .map((value: unknown) => String(value ?? "").trim())
        .filter(Boolean)
    )) as string[];

    if (orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required orderIds field." },
        { status: 400 }
      );
    }

    const orderScope: CustomerOrderScopeFilter = {
      isSuperAdmin: !!session.isSuperAdmin,
      countryIds: session.isSuperAdmin ? null : ((session.countryIds ?? []) as string[]),
      countryBranchIds: session.isSuperAdmin ? null : ((session.countryBranchIds ?? []) as string[]),
      cityBranchIds: session.isSuperAdmin ? null : ((session.cityBranchIds ?? []) as string[]),
      clearingAgentIds: session.isSuperAdmin ? null : ((session.clearingAgentIds ?? []) as string[]),
      createdByUserId: typeof session.userId === "string" ? session.userId : null
    };
    const visibleOrders = await listCustomerOrders(undefined, orderScope);
    const visibleOrderIds = new Set(visibleOrders.map((order: any) => String(order.id)));
    if (!session.isSuperAdmin && orderIds.some((id) => !visibleOrderIds.has(id))) {
      return NextResponse.json({ success: false, error: "One or more selected customer orders are outside your authorized scope." }, { status: 403 });
    }

    const bill = await ensureCustomerBillForOrders(orderIds, typeof session.userId === "string" ? session.userId : null);
    return NextResponse.json({ success: true, data: bill });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    console.error("POST /api/erp/clearing-agent/customer-bill error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate customer bill." },
      { status: 500 }
    );
  }
}
