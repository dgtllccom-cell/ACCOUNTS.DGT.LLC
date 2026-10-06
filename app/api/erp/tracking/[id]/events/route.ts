import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { shipmentTrackingService, TRACKING_EVENT_CODES } from "@/lib/services/shipment-tracking-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const body = await req.json();

    const {
      eventCode,
      eventName,
      locationName,
      eventTime,
      status,
      providerName,
      vesselName,
      voyageNumber,
      containerNumber,
      eta,
      remarks,
      legId,
    } = body;

    if (!eventCode || !TRACKING_EVENT_CODES.includes(eventCode)) {
      return NextResponse.json(
        { ok: false, error: { message: `Invalid event code. Must be one of: ${TRACKING_EVENT_CODES.join(", ")}` } },
        { status: 400 }
      );
    }

    const event = await shipmentTrackingService.recordTrackingEvent(
      {
        orderId: id,
        legId,
        eventCode,
        eventName,
        locationName,
        eventTime,
        status,
        providerName,
        vesselName,
        voyageNumber,
        containerNumber,
        eta,
        remarks,
      },
      session
    );

    return NextResponse.json({
      ok: true,
      data: { event },
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    console.error("Tracking event record error:", err);
    return NextResponse.json(
      { ok: false, error: { message: err?.message || "Failed to record tracking event" } },
      { status: err?.status || 500 }
    );
  }
}
