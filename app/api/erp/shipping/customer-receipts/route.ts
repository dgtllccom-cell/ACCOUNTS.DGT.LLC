import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createReceipt } from "@/lib/services/customer-receipt-service";

/**
 * GET/POST /api/erp/shipping/customer-receipts
 * Customer receipt collection with Business/Shipping/Split/Unallocated
 * allocation — genuinely new (no receipt/payment-collection system existed
 * anywhere in the app before this).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customer_receipts", action: "read" });
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");

    const rows = await withLocalPg((sql) => {
      return sql`
        SELECT r.*,
          (SELECT json_agg(a.*) FROM public.customer_receipt_allocations a WHERE a.receipt_id = r.id) AS allocations
        FROM public.customer_receipts r
        WHERE r.deleted_at IS NULL
          AND (${customerId ? sql`r.customer_id = ${customerId}` : sql`true`})
          AND (${session.isSuperAdmin ? sql`true` : sql`r.country_id = ANY(${session.countryIds})`})
        ORDER BY r.created_at DESC
        LIMIT 500
      `;
    });

    return NextResponse.json({ success: true, data: rows ?? [] });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "customer_receipts", action: "create" });
    const body = await req.json();

    if (!body.customerId) return NextResponse.json({ success: false, error: "customerId is required" }, { status: 400 });
    if (!body.cashLedgerId) return NextResponse.json({ success: false, error: "cashLedgerId is required" }, { status: 400 });
    if (!(Number(body.amount) > 0)) return NextResponse.json({ success: false, error: "amount must be greater than zero" }, { status: 400 });
    if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
      return NextResponse.json({ success: false, error: "allocations are required" }, { status: 400 });
    }

    // A receipt's scope must always be a real value — never left null "because
    // Super Admin doesn't have one" — or every country admin sees it (a null
    // scope reads as "unscoped legacy row", which is meaningless for a table
    // that starts empty today). Fall back to the customer's own country.
    let countryId = body.countryId ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);
    const countryBranchId = body.countryBranchId ?? session.countryBranchIds?.[0] ?? null;
    const cityBranchId = body.cityBranchId ?? session.cityBranchIds?.[0] ?? null;
    if (!countryId) {
      const customerRow = await withLocalPg((sql) => sql`SELECT country_id FROM public.customers WHERE id = ${body.customerId} LIMIT 1`);
      countryId = customerRow?.[0]?.country_id ?? null;
    }

    const receipt = await createReceipt({
      customerId: body.customerId,
      countryId,
      countryBranchId,
      cityBranchId,
      receiptDate: body.receiptDate,
      currencyCode: body.currencyCode ?? "USD",
      amount: Number(body.amount),
      paymentMethod: body.paymentMethod ?? "cash",
      bankId: body.bankId ?? null,
      cashLedgerId: body.cashLedgerId,
      allocationType: body.allocationType ?? "unallocated",
      allocations: body.allocations,
      remarks: body.remarks ?? null,
      createdBy: session.userId
    });

    return NextResponse.json({ success: true, data: receipt });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
