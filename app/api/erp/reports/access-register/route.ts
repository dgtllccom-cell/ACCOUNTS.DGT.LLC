import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { getAccessRegisterData } from "@/lib/repositories/access-register-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const rows = await getAccessRegisterData();
    return NextResponse.json({ rows, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    const status = error?.status ?? 500;
    return NextResponse.json({ error: error?.message ?? "Failed to load access register", rows: [] }, { status });
  }
}
