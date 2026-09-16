import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import {
  getCustomerBillById,
  saveCustomerBill
} from "@/lib/services/clearing-customer-bill-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireErpSession();
    const { id } = await context.params;
    const bill = await getCustomerBillById(id);
    if (!bill) {
      return NextResponse.json({ success: false, error: "Customer bill not found." }, { status: 404 });
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
    const { id } = await context.params;
    const body = await req.json();

    const updated = await saveCustomerBill({
      id,
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
