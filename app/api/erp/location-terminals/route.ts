import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, apiCreated, ApiClientError, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, wantsRawRecord } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "location_master", action: "read" });

    const db = createSupabaseAdminClient() as any;
    const params = request.nextUrl.searchParams;
    const locationId = params.get("locationId");
    const status = params.get("status");
    const search = params.get("search")?.trim();

    let qb = db
      .from("erp_location_terminals")
      .select(`
        id, location_id, name, code, terminal_type, status, description,
        created_by, updated_by, created_at, updated_at,
        location:erp_locations(id, name, location_type, country_id, country:countries(id, name, iso2))
      `)
      .is("deleted_at", null);

    if (locationId) {
      qb = qb.eq("location_id", locationId);
    }
    if (status) {
      qb = qb.eq("status", status);
    }
    if (search) {
      qb = qb.ilike("name", `%${search}%`);
    }

    const { data, error } = await qb.order("name", { ascending: true }).limit(500);
    if (error) throw error;

    let terminals: any[] = data || [];
    if (!wantsRawRecord(request) && terminals.length > 0) {
      const lang = await getRequestLanguage(params.get("lang"));
      terminals = await localizeRecordFields<any>(terminals, "erp_location_terminals", ["name"], lang);
    }

    return apiOk({ terminals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "location_master", action: "create" });

    const body = await request.json();
    const locationId = String(body?.locationId ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const code = body?.code ? String(body.code).trim().toUpperCase() : null;
    const terminalType = String(body?.terminalType ?? "gate").trim();
    const description = body?.description ? String(body.description).trim() : null;

    if (!locationId) throw new ApiClientError("locationId is required");
    if (!name) throw new ApiClientError("name is required");

    const db = createSupabaseAdminClient() as any;

    // Check location existence and country authorization for country admin
    const { data: loc, error: locErr } = await db
      .from("erp_locations")
      .select("id, country_id")
      .eq("id", locationId)
      .is("deleted_at", null)
      .single();

    if (locErr || !loc) throw new ApiClientError("Location not found", { status: 404 });

    if (!session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(loc.country_id)) {
      throw new ApiClientError("Not authorized to manage gates for this country", { status: 403, code: "FORBIDDEN" });
    }

    // Check duplicate
    const { data: dup } = await db
      .from("erp_location_terminals")
      .select("id, status")
      .is("deleted_at", null)
      .eq("location_id", locationId)
      .ilike("name", name)
      .maybeSingle();

    if (dup) {
      throw new ApiClientError(
        `A gate/terminal named "${name}" already exists for this location (status: ${dup.status}).`,
        { status: 409, code: "DUPLICATE_TERMINAL" }
      );
    }

    const { data, error } = await db
      .from("erp_location_terminals")
      .insert([{
        location_id: locationId,
        name,
        code,
        terminal_type: terminalType,
        description,
        status: "active",
        created_by: session.userId,
        updated_by: session.userId
      }])
      .select(`
        id, location_id, name, code, terminal_type, status, description,
        created_by, updated_by, created_at, updated_at
      `)
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        throw new ApiClientError(`Gate or terminal "${name}" already exists for this location.`, { status: 409, code: "DUPLICATE_TERMINAL" });
      }
      throw error;
    }

    await auditApiAction(request, {
      action: "location_terminal.create",
      entityTable: "erp_location_terminals",
      entityId: data.id,
      after: data
    });

    return apiCreated({ terminal: data });
  } catch (error) {
    return handleApiError(error);
  }
}
