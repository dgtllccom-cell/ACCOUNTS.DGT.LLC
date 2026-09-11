import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createShippingTransfer } from "@/lib/services/shipping-transfer-service";

/**
 * POST /api/erp/shipping/transfers/from-expense-line
 * Convenience wrapper around the existing shipping_expense_transfers create
 * flow: given an orderId + an existing bill_expense_lines.id, derive the
 * claim's origin (the caller's own scope — they incurred the cost) and
 * destination (the order's own owning scope — who the job ultimately belongs
 * to) automatically, so the UI never needs manual branch pickers for the
 * common "my branch paid for someone else's shipment" case.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await req.json();
    const { orderId, expenseLineId, note } = body ?? {};
    if (!orderId) return NextResponse.json({ success: false, error: "orderId is required" }, { status: 400 });
    if (!expenseLineId) return NextResponse.json({ success: false, error: "expenseLineId is required" }, { status: 400 });

    const originCountryId = session.isSuperAdmin ? null : session.countryIds?.[0] ?? null;
    const originCountryBranchId = session.countryBranchIds?.[0] ?? null;
    const originCityBranchId = session.cityBranchIds?.[0] ?? null;

    authorizeApiScope(session, {
      resource: "shipping_transfers",
      action: "create",
      countryId: originCountryId,
      countryBranchId: originCountryBranchId,
      cityBranchId: originCityBranchId
    });

    const data = await withLocalPg(async (sql) => {
      const [order] = await sql`
        SELECT id, order_no, country_id, country_branch_id, city_branch_id
        FROM public.clearing_customer_orders WHERE id = ${orderId} AND deleted_at IS NULL LIMIT 1
      `;
      if (!order) throw new Error("Customer order not found.");

      const [line] = await sql`
        SELECT bel.id, bel.expense_type, bel.grand_amount, bel.currency, bel.posting_status,
               be.bill_no, be.id AS bill_expense_id
        FROM public.bill_expense_lines bel
        JOIN public.bill_expenses be ON be.id = bel.bill_expense_id
        WHERE bel.id = ${expenseLineId} AND bel.deleted_at IS NULL LIMIT 1
      `;
      if (!line) throw new Error("Expense line not found.");
      if (line.posting_status !== "posted") throw new Error("Only a posted expense line can be claimed.");

      const existingClaim = await sql`
        SELECT id FROM public.shipping_expense_transfers
        WHERE source_table = 'bill_expense_lines' AND source_id = ${expenseLineId} AND deleted_at IS NULL LIMIT 1
      `;
      if (existingClaim.length > 0) throw new Error("This expense line already has a claim.");

      return { order, line };
    });
    if (!data) throw new Error("Claim creation needs a direct database connection.");

    const result = await createShippingTransfer({
      session,
      orderId,
      sourceTable: "bill_expense_lines",
      sourceId: expenseLineId,
      sourceReferenceNo: data.line.bill_no,
      origin: { countryId: originCountryId, countryBranchId: originCountryBranchId, cityBranchId: originCityBranchId },
      destination: {
        countryId: data.order.country_id,
        countryBranchId: data.order.country_branch_id,
        cityBranchId: data.order.city_branch_id
      },
      amount: Number(data.line.grand_amount),
      currencyCode: data.line.currency,
      category: data.line.expense_type,
      blReference: data.order.order_no,
      supportingDocument: note ?? null
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
