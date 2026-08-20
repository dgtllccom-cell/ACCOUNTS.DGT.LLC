import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { getEntityVersionTimeline } from "@/lib/audit/enterprise-audit-service";
import { canAccessCountry, canAccessCityBranch } from "@/lib/permissions/middleware";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession(request);
    const { searchParams } = new URL(request.url);

    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: "entityType and entityId are required parameters." },
        { status: 400 }
      );
    }

    const timeline = await getEntityVersionTimeline(entityType, entityId);

    // If non-super user, ensure record is within user's allowed country/branch
    if (!session.isSuperAdmin && !session.roles.includes("super_admin_reports")) {
      const firstEvent = timeline[0];
      if (firstEvent?.country_id && !canAccessCountry(session, firstEvent.country_id)) {
        return NextResponse.json({ error: "Access denied to foreign country record audit trail." }, { status: 403 });
      }
    }

    return NextResponse.json({
      success: true,
      entityType,
      entityId,
      totalVersions: timeline.length,
      timeline
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch version timeline." }, { status: 500 });
  }
}
