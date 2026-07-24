import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { auditApiAction } from "@/lib/api/audit";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { companyCreateSchema } from "@/lib/api/erp-validation";
import { companiesService } from "@/lib/services/companies-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();

    authorizeApiScope(session, { resource: "companies", action: "read" });

    const query = request.nextUrl.searchParams.get("q");
    const limit = request.nextUrl.searchParams.get("limit");

    const result = await companiesService.search({
      query,
      limit: limit ? Number(limit) : 20
    });

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();

    authorizeApiScope(session, { resource: "companies", action: "create" });

    const body = companyCreateSchema.parse(await request.json());

    const companyId = await companiesService.create(
      {
        name: body.name,
        legalName: body.legalName ?? null,
        baseCurrency: body.baseCurrency,
        originalLanguage: body.originalLanguage,
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
      session.userId
    );

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

    return apiCreated({ companyId });
  } catch (error) {
    return handleApiError(error);
  }
}


