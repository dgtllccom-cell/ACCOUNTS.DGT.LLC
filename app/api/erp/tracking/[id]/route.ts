import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { shipmentTrackingService } from "@/lib/services/shipment-tracking-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const domainParam = searchParams.get("domain") || "both";
    const domain = (["business", "shipping", "both"].includes(domainParam) ? domainParam : "both") as "business" | "shipping" | "both";

    const tracking = await shipmentTrackingService.getTrackingDetails(id, domain, session);

    if (!tracking) {
      return NextResponse.json(
        { ok: false, error: { message: "Shipment tracking record not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: tracking,
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    console.error("Tracking details error:", err);
    return NextResponse.json(
      { ok: false, error: { message: err?.message || "Failed to fetch tracking details" } },
      { status: err?.status || 500 }
    );
  }
}
