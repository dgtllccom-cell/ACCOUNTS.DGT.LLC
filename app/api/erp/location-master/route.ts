import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope, enforceScopeFilter, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { hasRolePermission } from "@/lib/permissions/middleware";
import { apiOk, apiCreated, ApiClientError, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, wantsRawRecord } from "@/lib/i18n/localize-records";

const LOCATION_TYPES = [
  "seaport", "airport", "land_border", "railway_terminal",
  "warehouse", "cross_stuffing", "city", "state", "country"
] as const;

/**
 * GET /api/erp/location-master?type=&countryId=&status=&search=
 * Central Location Master list. Extends the existing ports/warehouses masters
 * (indexed via legacy_port_id/legacy_warehouse_id) rather than replacing them.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "location_master", action: "read" });

    const db = createSupabaseAdminClient() as any;
    const params = request.nextUrl.searchParams;
    const type = params.get("type");
    const status = params.get("status");
    const search = params.get("search")?.trim();
    const explicitScope = getScopeFromSearchParams(request);

    let qb = db
      .from("erp_locations")
      .select(`
        id, location_type, name, code, country_id, state_province_id, city_id,
        country_branch_id, city_branch_id, status, requested_by, approved_by, approved_at,
        rejected_reason, legacy_port_id, legacy_warehouse_id, created_by, created_at, updated_at,
        country:countries(id, name, iso2)
      `)
      .is("deleted_at", null);

    if (type) {
      if (!LOCATION_TYPES.includes(type as any)) {
        throw new ApiClientError(`Unsupported location type: ${type}`);
      }
      qb = qb.eq("location_type", type);
    }
    if (status) qb = qb.eq("status", status);
    if (search) qb = qb.ilike("name", `%${search}%`);

    qb = enforceScopeFilter(qb, session, explicitScope);

    const { data, error } = await qb.order("name", { ascending: true }).limit(500);
    if (error) throw error;

    let locations: any[] = data || [];
    if (!wantsRawRecord(request) && locations.length > 0) {
      const lang = await getRequestLanguage(params.get("lang"));
      locations = await localizeRecordFields<any>(locations, "erp_locations", ["name"], lang);
    }

    return apiOk({ locations });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/erp/location-master
 * "Request New Location" — a requester without location_master:approve always lands
 * in pending_approval; Super Admin / an approver-role user is auto-active. Duplicate
 * (same type+country+name) is a 409, backed by erp_locations_no_duplicate_idx.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "location_master", action: "create" });

    const body = await request.json();
    const locationType = String(body?.locationType ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const countryId = body?.countryId ? String(body.countryId) : null;

    if (!LOCATION_TYPES.includes(locationType as any)) {
      throw new ApiClientError(`locationType must be one of: ${LOCATION_TYPES.join(", ")}`);
    }
    if (!name) throw new ApiClientError("name is required");
    if (!countryId) throw new ApiClientError("countryId is required");
    if (!session.isSuperAdmin && session.countryIds.length > 0 && !session.countryIds.includes(countryId)) {
      throw new ApiClientError("Not authorized for this country", { status: 403, code: "FORBIDDEN" });
    }

    const db = createSupabaseAdminClient() as any;

    const { data: dup } = await db
      .from("erp_locations")
      .select("id, status")
      .is("deleted_at", null)
      .eq("location_type", locationType)
      .eq("country_id", countryId)
      .ilike("name", name)
      .in("status", ["pending_approval", "active", "inactive"])
      .maybeSingle();
    if (dup) {
      throw new ApiClientError(
        `A ${locationType} named "${name}" already exists for this country (status: ${dup.status}).`,
        { status: 409, code: "DUPLICATE_LOCATION" }
      );
    }

    const canApprove = hasRolePermission(session, "location_master", "approve");
    const status = canApprove ? "active" : "pending_approval";

    const { data, error } = await db
      .from("erp_locations")
      .insert([{
        location_type: locationType,
        name,
        code: body?.code ? String(body.code) : null,
        country_id: countryId,
        state_province_id: body?.stateProvinceId ? String(body.stateProvinceId) : null,
        city_id: body?.cityId ? String(body.cityId) : null,
        country_branch_id: body?.countryBranchId ? String(body.countryBranchId) : null,
        city_branch_id: body?.cityBranchId ? String(body.cityBranchId) : null,
        status,
        requested_by: session.userId,
        approved_by: canApprove ? session.userId : null,
        approved_at: canApprove ? new Date().toISOString() : null,
        created_by: session.userId
      }])
      .select()
      .single();
    if (error) {
      if ((error as any).code === "23505") {
        throw new ApiClientError(`A ${locationType} named "${name}" already exists for this country.`, { status: 409, code: "DUPLICATE_LOCATION" });
      }
      throw error;
    }

    await auditApiAction(request, {
      action: "location_master.create",
      entityTable: "erp_locations",
      entityId: data.id,
      after: data
    });

    return apiCreated({ location: data });
  } catch (error) {
    return handleApiError(error);
  }
}
