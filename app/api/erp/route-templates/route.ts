import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope, enforceScopeFilter, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { apiOk, apiCreated, ApiClientError, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, wantsRawRecord } from "@/lib/i18n/localize-records";

type TemplateLeg = {
  legNo: number;
  fromCountryId: string;
  fromLocationId?: string | null;
  toCountryId: string;
  toLocationId?: string | null;
  transportMode: "by_sea" | "by_road" | "by_air" | "by_rail";
  clearanceType?: "import" | "export" | "transit" | null;
};

function validateLegs(legs: unknown): TemplateLeg[] {
  if (!Array.isArray(legs) || legs.length === 0) {
    throw new ApiClientError("legs must be a non-empty ordered array");
  }
  return legs.map((leg: any, idx: number) => {
    if (!leg?.fromCountryId || !leg?.toCountryId) {
      throw new ApiClientError(`Leg ${idx + 1}: fromCountryId and toCountryId are required`);
    }
    if (!["by_sea", "by_road", "by_air", "by_rail"].includes(leg?.transportMode)) {
      throw new ApiClientError(`Leg ${idx + 1}: transportMode must be by_sea, by_road, by_air, or by_rail`);
    }
    return {
      legNo: Number(leg.legNo ?? idx + 1),
      fromCountryId: String(leg.fromCountryId),
      fromLocationId: leg.fromLocationId ? String(leg.fromLocationId) : null,
      toCountryId: String(leg.toCountryId),
      toLocationId: leg.toLocationId ? String(leg.toLocationId) : null,
      transportMode: leg.transportMode,
      clearanceType: leg.clearanceType ?? null
    };
  });
}

/** GET /api/erp/route-templates?status=&search= */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "route_templates", action: "read" });

    const db = createSupabaseAdminClient() as any;
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const search = params.get("search")?.trim();
    const explicitScope = getScopeFromSearchParams(request);

    let qb = db
      .from("route_templates")
      .select("id, name, description, status, country_branch_id, city_branch_id, legs, created_by, created_at, updated_at")
      .is("deleted_at", null);

    if (status) qb = qb.eq("status", status);
    if (search) qb = qb.ilike("name", `%${search}%`);

    // Templates without a branch scope are global/shared — always visible.
    // enforceScopeFilter would otherwise exclude nulls for a non-super user, so scope
    // only when the caller explicitly asked for a branch-owned slice.
    if (explicitScope.countryBranchId || explicitScope.cityBranchId || explicitScope.countryId) {
      qb = enforceScopeFilter(qb, session, explicitScope);
    }

    const { data, error } = await qb.order("name", { ascending: true }).limit(200);
    if (error) throw error;

    let templates: any[] = data || [];
    if (!wantsRawRecord(request) && templates.length > 0) {
      const lang = await getRequestLanguage(params.get("lang"));
      templates = await localizeRecordFields<any>(templates, "route_templates", ["name", "description"], lang);
    }

    return apiOk({ templates });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/erp/route-templates — authorized users only (route_templates:create). */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "route_templates", action: "create" });

    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    if (!name) throw new ApiClientError("name is required");
    const legs = validateLegs(body?.legs);

    const db = createSupabaseAdminClient() as any;
    const { data, error } = await db
      .from("route_templates")
      .insert([{
        name,
        description: body?.description ? String(body.description) : null,
        status: "active",
        country_branch_id: body?.countryBranchId ? String(body.countryBranchId) : null,
        city_branch_id: body?.cityBranchId ? String(body.cityBranchId) : null,
        legs,
        created_by: session.userId
      }])
      .select()
      .single();
    if (error) throw error;

    await auditApiAction(request, {
      action: "route_template.create",
      entityTable: "route_templates",
      entityId: data.id,
      after: data
    });

    return apiCreated({ template: data });
  } catch (error) {
    return handleApiError(error);
  }
}
