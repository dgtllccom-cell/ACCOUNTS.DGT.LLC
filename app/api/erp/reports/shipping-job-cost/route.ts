import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { handleApiError } from "@/lib/api/response";
import { getCustomerOrderById } from "@/lib/services/clearing-customer-order-service";
import { canAccessOrder } from "@/lib/services/clearing-customer-order-scope";
import { getShippingOrderJobCost } from "@/lib/services/shipping-job-cost-service";

/**
 * GET /api/erp/reports/shipping-job-cost?orderId=
 * Per-order Job Cost / Profit summary: Customer Charges (revenue) minus Job
 * Expenses (bill_expense_lines, counted once), with Inter-Branch Claims shown
 * for tracking/status only — never added a second time into the total.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ success: false, error: "orderId is required" }, { status: 400 });

    const order = await getCustomerOrderById(orderId);
    if (!order) return NextResponse.json({ success: false, error: "Customer order not found" }, { status: 404 });
    if (!canAccessOrder(session, order)) {
      return NextResponse.json({ success: false, error: "Not authorized to view this order's job cost" }, { status: 403 });
    }

    const report = await getShippingOrderJobCost(orderId);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return handleApiError(error);
  }
}
