import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";
import { listChargesForBill, createBillCustomerCharge } from "@/lib/services/clearing-bill-customer-charge-service";

/**
 * GET/POST /api/erp/clearing-agent/payment-bill/[id]/customer-charges
 * The customer-charge (revenue) side of a bill — deliberately separate from
 * bill_expense_lines (the actual-expense/payable side, already built).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "clearing_bill_customer_charges", action: "read" });
    const { id } = await params;

    const bill = await withLocalPg((sql) => sql`
      SELECT id, country_id, city_branch_id FROM public.clearing_payment_bills WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
    `);
    if (!bill?.[0]) return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 });
    if (!session.isSuperAdmin && bill[0].country_id && !session.countryIds.includes(bill[0].country_id)) {
      return NextResponse.json({ success: false, error: "This bill is outside your authorized scope." }, { status: 403 });
    }

    const rows = await listChargesForBill(id);
    return NextResponse.json({ success: true, data: rows ?? [] });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "clearing_bill_customer_charges", action: "create" });
    const { id } = await params;
    const body = await req.json();

    if (!body.customerId) {
      return NextResponse.json({ success: false, error: "customerId is required" }, { status: 400 });
    }
    if (!(Number(body.amount) > 0)) {
      return NextResponse.json({ success: false, error: "amount must be greater than zero" }, { status: 400 });
    }

    const bill = await withLocalPg((sql) => sql`
      SELECT id, country_id, city_branch_id FROM public.clearing_payment_bills WHERE id = ${id} AND deleted_at IS NULL LIMIT 1
    `);
    if (!bill?.[0]) return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 });
    if (!session.isSuperAdmin && bill[0].country_id && !session.countryIds.includes(bill[0].country_id)) {
      return NextResponse.json({ success: false, error: "This bill is outside your authorized scope." }, { status: 403 });
    }

    const charge = await createBillCustomerCharge({
      billId: id,
      orderId: body.orderId ?? null,
      customerId: body.customerId,
      chargeType: body.chargeType ?? "other",
      currencyCode: body.currencyCode ?? "USD",
      amount: Number(body.amount),
      remarks: body.remarks ?? null,
      createdBy: session.userId
    });

    return NextResponse.json({ success: true, data: charge });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
