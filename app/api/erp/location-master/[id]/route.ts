import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, ApiClientError, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, wantsRawRecord } from "@/lib/i18n/localize-records";

async function loadLocation(db: any, id: string) {
  const { data, error } = await db
    .from("erp_locations")
    .select("*, country:countries(id, name, iso2)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "location_master", action: "read" });
    const { id } = await params;

    const db = createSupabaseAdminClient() as any;
    let location = await loadLocation(db, id);
    if (!location) throw new ApiClientError("Location not found", { status: 404, code: "NOT_FOUND" });

    if (!session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(location.country_id)) {
      throw new ApiClientError("Not authorized for this location", { status: 403, code: "FORBIDDEN" });
    }

    if (!wantsRawRecord(request)) {
      const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
      [location] = await localizeRecordFields<any>([location], "erp_locations", ["name"], lang);
    }

    return apiOk({ location });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "location_master", action: "update" });
    const { id } = await params;

    const db = createSupabaseAdminClient() as any;
    const existing = await loadLocation(db, id);
    if (!existing) throw new ApiClientError("Location not found", { status: 404, code: "NOT_FOUND" });
    if (!session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(existing.country_id)) {
      throw new ApiClientError("Not authorized for this location", { status: 403, code: "FORBIDDEN" });
    }

    const body = await request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body?.name !== undefined) patch.name = String(body.name).trim();
    if (body?.code !== undefined) patch.code = body.code ? String(body.code) : null;
    if (body?.stateProvinceId !== undefined) patch.state_province_id = body.stateProvinceId || null;
    if (body?.cityId !== undefined) patch.city_id = body.cityId || null;
    if (body?.countryBranchId !== undefined) patch.country_branch_id = body.countryBranchId || null;
    if (body?.cityBranchId !== undefined) patch.city_branch_id = body.cityBranchId || null;
    if (body?.status !== undefined) {
      const nextStatus = String(body.status);
      if (!["active", "inactive"].includes(nextStatus)) {
        throw new ApiClientError("status can only be toggled between active/inactive here — use the approval endpoint for pending_approval/rejected.");
      }
      if (existing.status === "pending_approval") {
        throw new ApiClientError("This location is still pending approval — use the approval endpoint.", { status: 409, code: "PENDING_APPROVAL" });
      }
      patch.status = nextStatus;
    }

    const { data, error } = await db.from("erp_locations").update(patch).eq("id", id).select().single();
    if (error) {
      if ((error as any).code === "23505") {
        throw new ApiClientError("A location with this name already exists for this type/country.", { status: 409, code: "DUPLICATE_LOCATION" });
      }
      throw error;
    }

    await auditApiAction(request, {
      action: "location_master.update",
      entityTable: "erp_locations",
      entityId: id,
      before: existing,
      after: data
    });

    return apiOk({ location: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "location_master", action: "delete" });
    const { id } = await params;

    const db = createSupabaseAdminClient() as any;
    const existing = await loadLocation(db, id);
    if (!existing) throw new ApiClientError("Location not found", { status: 404, code: "NOT_FOUND" });
    if (!session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(existing.country_id)) {
      throw new ApiClientError("Not authorized for this location", { status: 403, code: "FORBIDDEN" });
    }

    const { data, error } = await db
      .from("erp_locations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    await auditApiAction(request, {
      action: "location_master.delete",
      entityTable: "erp_locations",
      entityId: id,
      before: existing,
      after: data
    });

    return apiOk({ location: data });
  } catch (error) {
    return handleApiError(error);
  }
}
