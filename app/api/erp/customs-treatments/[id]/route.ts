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
      .from("erp_customs_treatments")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (curErr || !current) {
      throw new ApiClientError("Customs Office not found", { status: 404 });
    }

    if (!session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(current.country_id)) {
      throw new ApiClientError("Not authorized to modify customs offices for this country", { status: 403, code: "FORBIDDEN" });
    }

    const updates: Record<string, any> = {
      updated_by: session.userId,
      updated_at: new Date().toISOString()
    };

    if (body.status !== undefined) {
      if (!["active", "inactive"].includes(body.status)) {
        throw new ApiClientError("status must be active or inactive");
      }
      updates.status = body.status;
    }

    if (body.officeName !== undefined) {
      const name = String(body.officeName).trim();
      if (!name) throw new ApiClientError("officeName cannot be empty");
      updates.office_name = name;
    }

    if (body.officeCode !== undefined) {
      updates.office_code = body.officeCode ? String(body.officeCode).trim().toUpperCase() : null;
    }

    if (body.allowedMovements !== undefined) {
      if (Array.isArray(body.allowedMovements) && body.allowedMovements.length > 0) {
        updates.allowed_movements = body.allowedMovements;
      }
    }

    if (body.allowedTreatments !== undefined) {
      if (Array.isArray(body.allowedTreatments) && body.allowedTreatments.length > 0) {
        updates.allowed_treatments = body.allowedTreatments;
      }
    }

    if (body.gateId !== undefined) {
      updates.gate_id = body.gateId || null;
    }

    if (body.description !== undefined) {
      updates.description = body.description ? String(body.description).trim() : null;
    }

    const { data: updated, error } = await db
      .from("erp_customs_treatments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        throw new ApiClientError("A customs office with this name already exists.", { status: 409, code: "DUPLICATE_CUSTOMS_OFFICE" });
      }
      throw error;
    }

    await auditApiAction(request, {
      action: "customs_office.update",
      entityTable: "erp_customs_treatments",
      entityId: id,
      before: current,
      after: updated
    });

    return apiOk({ office: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
