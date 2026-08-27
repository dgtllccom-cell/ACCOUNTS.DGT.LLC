import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { getDeletedRecordDetail } from "@/lib/audit/enterprise-audit-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    const detail = await getDeletedRecordDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Deleted record not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: detail
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch deleted record details." }, { status: 500 });
  }
}
