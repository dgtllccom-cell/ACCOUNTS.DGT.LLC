import { NextResponse } from "next/server";
import { ensureEmployeesTable } from "@/lib/services/ensure-employees-table";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const success = await ensureEmployeesTable();
    if (success) {
      return NextResponse.json({ success: true, message: "Employee migration applied and schema cache reloaded successfully" });
    } else {
      return NextResponse.json({ error: "Failed to apply employee migration" }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
