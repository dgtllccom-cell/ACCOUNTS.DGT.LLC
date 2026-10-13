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
    const countryId = params.get("countryId");
    const locationId = params.get("locationId");
    const status = params.get("status");
    const search = params.get("search")?.trim();

    let qb = db
      .from("erp_customs_treatments")
      .select(`
        id, country_id, location_id, gate_id, office_name, office_code,
        allowed_movements, allowed_treatments, status, description,
        created_by, updated_by, created_at, updated_at,
        country:countries(id, name, iso2),
        location:erp_locations(id, name, location_type),
        gate:erp_location_terminals(id, name, code)
      `)
      .is("deleted_at", null);

    if (countryId) {
      qb = qb.eq("country_id", countryId);
    }
    if (locationId) {
      qb = qb.eq("location_id", locationId);
    }
    if (status) {
      qb = qb.eq("status", status);
    }
    if (search) {
      qb = qb.ilike("office_name", `%${search}%`);
    }

    const { data, error } = await qb.order("office_name", { ascending: true }).limit(500);
    if (error) throw error;

    let offices: any[] = data || [];
    if (!wantsRawRecord(request) && offices.length > 0) {
      const lang = await getRequestLanguage(params.get("lang"));
      offices = await localizeRecordFields<any>(offices, "erp_customs_treatments", ["office_name"], lang);
    }

    return apiOk({ offices });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "location_master", action: "create" });

    const body = await request.json();
    const countryId = String(body?.countryId ?? "").trim();
    const locationId = body?.locationId ? String(body.locationId).trim() : null;
    const gateId = body?.gateId ? String(body.gateId).trim() : null;
    const officeName = String(body?.officeName ?? "").trim();
    const officeCode = body?.officeCode ? String(body.officeCode).trim().toUpperCase() : null;
    const allowedMovements = Array.isArray(body?.allowedMovements) && body.allowedMovements.length > 0
      ? body.allowedMovements
      : ["import", "export", "transit", "re_export"];
    const allowedTreatments = Array.isArray(body?.allowedTreatments) && body.allowedTreatments.length > 0
      ? body.allowedTreatments
      : ["import_duty_paid", "export_clearance", "transit_bonded", "re_export", "free_zone", "local_clearance", "no_duty_exempt"];
    const description = body?.description ? String(body.description).trim() : null;

    if (!countryId) throw new ApiClientError("countryId is required");
    if (!officeName) throw new ApiClientError("officeName is required");

    if (!session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(countryId)) {
      throw new ApiClientError("Not authorized to manage customs offices for this country", { status: 403, code: "FORBIDDEN" });
    }

    const db = createSupabaseAdminClient() as any;

    // Check duplicate
    let dupQuery = db
      .from("erp_customs_treatments")
      .select("id, status")
      .is("deleted_at", null)
      .eq("country_id", countryId)
      .ilike("office_name", officeName);

    if (locationId) {
      dupQuery = dupQuery.eq("location_id", locationId);
    }

    const { data: dup } = await dupQuery.maybeSingle();
    if (dup) {
      throw new ApiClientError(
        `A customs office named "${officeName}" already exists for this country/location (status: ${dup.status}).`,
        { status: 409, code: "DUPLICATE_CUSTOMS_OFFICE" }
      );
    }

    const { data, error } = await db
      .from("erp_customs_treatments")
      .insert([{
        country_id: countryId,
        location_id: locationId,
        gate_id: gateId,
        office_name: officeName,
        office_code: officeCode,
        allowed_movements: allowedMovements,
        allowed_treatments: allowedTreatments,
        description,
        status: "active",
        created_by: session.userId,
        updated_by: session.userId
      }])
      .select()
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        throw new ApiClientError(`Customs office "${officeName}" already exists.`, { status: 409, code: "DUPLICATE_CUSTOMS_OFFICE" });
      }
      throw error;
    }

    await auditApiAction(request, {
      action: "customs_office.create",
      entityTable: "erp_customs_treatments",
      entityId: data.id,
      after: data
    });

    return apiCreated({ office: data });
  } catch (error) {
    return handleApiError(error);
  }
}
