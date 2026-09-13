import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession, sessionInDomain } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
import { companyCreateSchema } from "@/lib/api/erp-validation";
import { companiesService } from "@/lib/services/companies-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    try {
      await requireErpSession();
    } catch {
      // Allow read fallback
    }

    const query = request.nextUrl.searchParams.get("q");
    const limit = request.nextUrl.searchParams.get("limit");
    const ownerPersonId = request.nextUrl.searchParams.get("ownerPersonId");
    const countryId = request.nextUrl.searchParams.get("countryId");
    const countryBranchId = request.nextUrl.searchParams.get("countryBranchId");
    const cityBranchId = request.nextUrl.searchParams.get("cityBranchId");
    const isBranchOperativeParam = request.nextUrl.searchParams.get("isBranchOperative");
    const isBranchOperative = isBranchOperativeParam !== null ? isBranchOperativeParam === "true" : undefined;
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));

    const result = await companiesService.search({
      query,
      ownerPersonId,
      countryId,
      countryBranchId,
      cityBranchId,
      isBranchOperative,
      limit: limit ? Number(limit) : 500
    });

    let companies: any[] = (result as any).companies ?? [];
    if (Array.isArray(companies) && companies.length > 0) {
      // One batched call (one connection, one translations query) instead of six —
      // the per-field variant reconnected to the pooler each time (~12 s total).
      companies = await localizeRecordFields<any>(
        companies,
        "companies",
        ["name", "legal_name", "owner_name", "country_name", "state_name", "city_name"],
        lang,
        { phraseFallback: true }
      );
    }

    return apiOk({ ...(result as any), companies });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();

    const raw = await request.json();
    const body = companyCreateSchema.parse(raw);

    authorizeApiScope(session, {
      resource: "companies",
      action: "create",
      countryId: body.countryId ?? null,
      countryBranchId: body.countryBranchId ?? null,
      cityBranchId: body.cityBranchId ?? null
    });

    // Geography scope alone doesn't gate the Business/Shipping axis — resolve
    // the target branch's own operational_domain (companies themselves carry
    // no domain flag, but the branch they're filed under does) and reject a
    // caller whose session isn't in that domain, mirroring the same check
    // already added this session for accounts/account-categories/branches.
    if (body.countryBranchId || body.cityBranchId) {
      const targetDomain = await withLocalPg(async (sql) => {
        if (body.cityBranchId) {
          const rows = (await sql`select operational_domain from public.city_branches where id = ${body.cityBranchId}::uuid`) as unknown as any[];
          if (rows[0]?.operational_domain) return rows[0].operational_domain as "business" | "shipping";
        }
        if (body.countryBranchId) {
          const rows = (await sql`select operational_domain from public.country_branches where id = ${body.countryBranchId}::uuid`) as unknown as any[];
          if (rows[0]?.operational_domain) return rows[0].operational_domain as "business" | "shipping";
        }
        return "business" as const;
      });
      const resolvedDomain = targetDomain ?? "business";
      if (!sessionInDomain(session, resolvedDomain)) {
        throw new ApiClientError(
          `You do not have ${resolvedDomain} domain access to create a company under this branch.`,
          { status: 403, code: "DOMAIN_FORBIDDEN" }
        );
      }
    }

    const companyId = await companiesService.create(
      {
        name: body.name,
        legalName: body.legalName ?? null,
        baseCurrency: body.baseCurrency || "USD",
        originalLanguage: body.originalLanguage || "en",
        ownerName: body.ownerName ?? null,
        ownerPersonId: body.ownerPersonId ?? null,
        managerPersonId: body.managerPersonId ?? null,
        businessType: body.businessType ?? null,
        countryId: body.countryId ?? null,
        countryBranchId: body.countryBranchId ?? null,
        cityBranchId: body.cityBranchId ?? null,
        isBranchOperative: body.isBranchOperative ?? false,
        stateProvinceId: body.stateProvinceId ?? null,
        districtId: body.districtId ?? null,
        cityId: body.cityId ?? null,
        areaLocationId: body.areaLocationId ?? null,
        countryName: body.countryName ?? null,
        stateName: body.stateName ?? null,
        districtName: body.districtName ?? null,
        cityName: body.cityName ?? null,
        areaName: body.areaName ?? null,
        zipCode: body.zipCode ?? null,
        address: body.address ?? null,
        contacts: body.contacts ?? [],
        registrations: body.registrations ?? [],
        ownerIds: body.ownerIds ?? []
      },
      session.userId
    );

    try {
      await auditApiAction(request, {
        action: "companies.create.api",
        entityTable: "companies",
        entityId: companyId,
        after: {
          name: body.name,
          legalName: body.legalName ?? null,
          baseCurrency: body.baseCurrency
        }
      });
    } catch {}

    return apiCreated({ companyId });
  } catch (error) {
    return handleApiError(error);
  }
}
