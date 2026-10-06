import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { shipmentTrackingService } from "@/lib/services/shipment-tracking-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q") || "";
    const domainParam = searchParams.get("domain") || "both";
    const domain = (["business", "shipping", "both"].includes(domainParam) ? domainParam : "both") as
      | "business"
      | "shipping"
      | "both";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const modeFilter = searchParams.get("mode") || undefined;
    const statusFilter = searchParams.get("status") || undefined;

    const result = await shipmentTrackingService.searchTrackingList(
      q,
      domain,
      session,
      limit,
      offset,
      modeFilter,
      statusFilter
    );

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    console.error("Tracking list error:", err);
    return NextResponse.json(
      { ok: false, error: { message: err?.message || "Failed to load tracking list" } },
      { status: err?.status || 500 }
    );
  }
}
