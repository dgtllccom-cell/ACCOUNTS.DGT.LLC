import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { postCustomerBillToLedger } from "@/lib/services/clearing-customer-bill-service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;

    const result = await postCustomerBillToLedger(id, session.userId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    console.error("POST /api/erp/clearing-agent/customer-bill/[id]/post error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to post customer bill to ledger." },
      { status: 500 }
    );
  }
}
