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
      .from("erp_location_terminals")
      .select("*, location:erp_locations(country_id)")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (curErr || !current) {
      throw new ApiClientError("Gate or Terminal not found", { status: 404 });
    }

    if (!session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(current.location?.country_id)) {
      throw new ApiClientError("Not authorized to modify gates for this country", { status: 403, code: "FORBIDDEN" });
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

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new ApiClientError("name cannot be empty");
      updates.name = name;
    }

    if (body.code !== undefined) {
      updates.code = body.code ? String(body.code).trim().toUpperCase() : null;
    }

    if (body.terminalType !== undefined) {
      updates.terminal_type = String(body.terminalType).trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description ? String(body.description).trim() : null;
    }

    const { data: updated, error } = await db
      .from("erp_location_terminals")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        throw new ApiClientError("A gate/terminal with this name or code already exists.", { status: 409, code: "DUPLICATE_TERMINAL" });
      }
      throw error;
    }

    await auditApiAction(request, {
      action: "location_terminal.update",
      entityTable: "erp_location_terminals",
      entityId: id,
      before: current,
      after: updated
    });

    return apiOk({ terminal: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
