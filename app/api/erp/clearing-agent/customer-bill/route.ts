import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import {
  listCustomerBills,
  ensureCustomerBillForOrder,
  getCustomerBillByOrderId
} from "@/lib/services/clearing-customer-bill-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    if (orderId) {
      const bill = await getCustomerBillByOrderId(orderId);
      return NextResponse.json({ success: true, data: bill });
    }

    const bills = await listCustomerBills({
      orderId: orderId ?? undefined,
      customerId: customerId ?? undefined,
      status: status ?? undefined,
      search: search ?? undefined
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
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Missing required orderId field." },
        { status: 400 }
      );
    }

    const bill = await ensureCustomerBillForOrder(orderId, session.userId);
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
