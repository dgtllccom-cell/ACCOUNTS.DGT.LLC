import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, ApiClientError, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "location_master", action: "update" });

    const { id } = await context.params;
    const body = await request.json();

    const db = createSupabaseAdminClient() as any;

    const { data: current, error: curErr } = await db
      .from("erp_locations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (curErr || !current) {
      throw new ApiClientError("Location not found", { status: 404 });
    }

    if (!session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(current.country_id)) {
      throw new ApiClientError("Not authorized to modify locations for this country", { status: 403, code: "FORBIDDEN" });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (body.status !== undefined) {
      if (!["active", "inactive", "pending_approval", "rejected"].includes(body.status)) {
        throw new ApiClientError("Invalid status");
      }
      updates.status = body.status;
    }

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new ApiClientError("Name cannot be empty");
      updates.name = name;
    }

    if (body.code !== undefined) {
      updates.code = body.code ? String(body.code).trim().toUpperCase() : null;
    }

    if (body.locationType !== undefined) {
      updates.location_type = String(body.locationType).trim();
    }

    const { data: updated, error } = await db
      .from("erp_locations")
      .update(updates)
      .eq("id", id)
      .select(`
        id, location_type, name, code, country_id, state_province_id, city_id,
        status, requested_by, approved_by, approved_at, rejected_reason,
        created_by, created_at, updated_at,
        country:countries(id, name, iso2)
      `)
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        throw new ApiClientError("A location with this name or code already exists for this country.", { status: 409, code: "DUPLICATE_LOCATION" });
      }
      throw error;
    }

    await auditApiAction(request, {
      action: "location_master.update",
      entityTable: "erp_locations",
      entityId: id,
      before: current,
      after: updated
    });

    return apiOk({ location: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
