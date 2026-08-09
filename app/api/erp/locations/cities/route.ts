import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordNames } from "@/lib/i18n/localize-records";

function isUuid(value: any): boolean {
  if (!value || typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}

export async function GET(request: NextRequest) {
  try {
    try {
      await requireErpSession();
    } catch {
      // Unauthenticated access for login form dropdowns
    }
    const countryId = request.nextUrl.searchParams.get("countryId");
    if (!countryId) {
      return apiOk({ cities: [] });
    }

    const stateProvinceId = request.nextUrl.searchParams.get("stateProvinceId");
    const districtId = request.nextUrl.searchParams.get("districtId");
    const q = request.nextUrl.searchParams.get("q");
    let cities = await locationsRepository.listCities({
      countryId,
      stateProvinceId: stateProvinceId ?? null,
      districtId: districtId ?? null,
      query: q,
      limit: 500
    });
    const lang = await getRequestLanguage();
    cities = await localizeRecordNames(cities, "cities", "name", lang);

    return apiOk({ cities });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.countryIds.length) {
      throw new Error("Location write is not allowed.");
    }

    const body = (await request.json()) as {
      countryId: string;
      stateProvinceId?: string | null;
      districtId?: string | null;
      name: string;
      code?: string | null;
      zipCode?: string | null;
    };

    if (!body.countryId || !body.name?.trim()) {
      throw new Error("countryId and name are required");
    }

    const resolvedCountryId = await locationsRepository.resolveCountryUuid(body.countryId);
    const resolvedStateId = body.stateProvinceId ? await locationsRepository.resolveStateUuid(body.stateProvinceId, resolvedCountryId) : null;
    const resolvedDistrictId = body.districtId ? await locationsRepository.resolveDistrictUuid(body.districtId, resolvedStateId ?? undefined) : null;

    if (!session.isSuperAdmin && !session.countryIds.includes(body.countryId) && !session.countryIds.includes(resolvedCountryId)) {
      throw new Error("Country scope is not allowed.");
    }

    const city = await locationsRepository.createCity({
      countryId: resolvedCountryId,
      stateProvinceId: resolvedStateId,
      districtId: resolvedDistrictId,
      name: body.name,
      code: body.code ?? null,
      zipCode: body.zipCode ?? null,
      createdBy: isUuid(session.userId) ? session.userId : null
    });

    return apiOk({ city });
  } catch (error) {
    return handleApiError(error);
  }
}
