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
    const domain = (["business", "shipping", "both"].includes(domainParam) ? domainParam : "both") as "business" | "shipping" | "both";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const results = await shipmentTrackingService.searchTracking(q, domain, session, limit);

    return NextResponse.json({
      ok: true,
      data: {
        results: results || [],
        count: (results || []).length,
      },
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    console.error("Tracking search error:", err);
    return NextResponse.json(
      { ok: false, error: { message: err?.message || "Failed to search tracking records" } },
      { status: err?.status || 500 }
    );
  }
}
