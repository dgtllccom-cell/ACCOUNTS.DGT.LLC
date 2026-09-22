import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { rethrowIfNextControlFlow } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setLocationApprovalStatus } from "@/lib/services/location-master-approval-service";

/**
 * PATCH /api/erp/location-master/[id]/approval
 * body: { action: "approve" | "reject", reason?: string }
 * Super Admin (permissions:"*:*") / Country Admin only (location_master:approve /
 * location_master:reject — see lib/permissions/enterprise-roles.ts). Same shape as
 * app/api/erp/clearing-agent/customer-order/[id]/approval/route.ts.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Location id is required" }, { status: 400 });
    }

    const body = await req.json();
    const action = String(body?.action ?? "").trim();
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ success: false, error: "action must be 'approve' or 'reject'" }, { status: 400 });
    }

    authorizeApiScope(session, { resource: "location_master", action });

    const db = createSupabaseAdminClient() as any;
    const { data: existing, error: loadError } = await db
      .from("erp_locations")
      .select("id, status, country_id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) {
      return NextResponse.json({ success: false, error: "Location not found" }, { status: 404 });
    }
    if (!session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(existing.country_id)) {
      return NextResponse.json({ success: false, error: "Not authorized for this location" }, { status: 403 });
    }

    const result = await setLocationApprovalStatus(id, action as "approve" | "reject", session.userId, body?.reason ?? null);

    await auditApiAction(req, {
      action: `location_master.${action}`,
      entityTable: "erp_locations",
      entityId: id,
      before: { status: existing.status },
      after: { status: result.status, reason: body?.reason ?? null }
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    rethrowIfNextControlFlow(error);
    const status = /not found/i.test(error?.message ?? "") ? 404 : /must be in pending_approval/i.test(error?.message ?? "") ? 409 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
