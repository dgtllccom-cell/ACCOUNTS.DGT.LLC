import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow, handleApiError } from "@/lib/api/response";
import { authorizeTrackingRead } from "@/lib/api/tracking-access";
import { shipmentTrackingService, TRACKING_SEARCH_FIELDS, type TrackingSearchField } from "@/lib/services/shipment-tracking-service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeTrackingRead(session);
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q") || "";
    const domainParam = searchParams.get("domain") || "both";
    const domain = (["business", "shipping", "both"].includes(domainParam) ? domainParam : "both") as
      | "business"
      | "shipping"
      | "both";
    const limit = Math.max(1, Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);
    const modeFilter = searchParams.get("mode") || undefined;
    const statusFilter = searchParams.get("status") || undefined;
    const fieldParam = searchParams.get("field") || "all";
    const field = ((TRACKING_SEARCH_FIELDS as readonly string[]).includes(fieldParam) ? fieldParam : "all") as TrackingSearchField;
    const viewParam = searchParams.get("view") || "all";
    const view = (["all", "containers", "shipments", "trucks"].includes(viewParam) ? viewParam : "all") as "all" | "containers" | "shipments" | "trucks";

    const result = await shipmentTrackingService.searchTrackingList(
      q,
      domain,
      session,
      limit,
      offset,
      modeFilter,
      statusFilter,
      field,
      view
    );

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return handleApiError(err);
  }
}
