import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { companyCreateSchema } from "@/lib/api/erp-validation";
import { companiesService } from "@/lib/services/companies-service";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    try {
      await requireErpSession();
    } catch {
      // Allow read fallback
    }

    const query = request.nextUrl.searchParams.get("q");
    const limit = request.nextUrl.searchParams.get("limit");
    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");

    const result = await companiesService.search({
      query,
      limit: limit ? Number(limit) : 500
    });

    let companies: any[] = (result as any).companies ?? [];
    // Always resolve — see customers/[id]/route.ts for why skipping lang === "en" would leak
    // non-English source text into the English view.
    if (Array.isArray(companies) && companies.length > 0) {
      companies = await localizeRecordNames<any>(companies, "companies", "name", lang, { phraseFallback: true });
      companies = await localizeRecordNames<any>(companies, "companies", "legal_name", lang, { phraseFallback: true });
      companies = await localizeRecordNames<any>(companies, "companies", "owner_name", lang, { phraseFallback: true });
      companies = await localizeRecordNames<any>(companies, "companies", "country_name", lang, { phraseFallback: true });
      companies = await localizeRecordNames<any>(companies, "companies", "state_name", lang, { phraseFallback: true });
      companies = await localizeRecordNames<any>(companies, "companies", "city_name", lang, { phraseFallback: true });
    }

    return apiOk({ ...(result as any), companies });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    let session = null;
    try {
      session = await requireErpSession();
    } catch {
      // allow fallback userId if unauthenticated demo
    }

    const raw = await request.json();
    const body = companyCreateSchema.parse(raw);

    const companyId = await companiesService.create(
      {
        name: body.name,
        legalName: body.legalName ?? null,
        baseCurrency: body.baseCurrency || "USD",
        originalLanguage: body.originalLanguage || "en",
        ownerName: body.ownerName ?? null,
        businessType: body.businessType ?? null,
        countryId: body.countryId ?? null,
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
      session?.userId ?? null
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
