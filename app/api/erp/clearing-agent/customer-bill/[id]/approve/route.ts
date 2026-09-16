import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { approveCustomerBill } from "@/lib/services/clearing-customer-bill-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    const bill = await approveCustomerBill(id, session.userId);
    return NextResponse.json({ success: true, data: bill });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to approve customer bill." },
      { status: 500 }
    );
  }
}
