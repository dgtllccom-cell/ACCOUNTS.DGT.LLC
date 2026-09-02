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
    let session = null;
    try {
      session = await requireErpSession();
    } catch {
      // Unauthenticated dropdown access
    }
    const cityId = request.nextUrl.searchParams.get("cityId");
    if (!cityId) {
      return apiOk({ areas: [] });
    }

    if (session && !session.isSuperAdmin && session.countryIds?.length > 0) {
      const city = await locationsRepository.getCityById(cityId);
      if (city && !session.countryIds.includes(city.country_id)) {
        return apiOk({ areas: [] });
      }
    }

    const q = request.nextUrl.searchParams.get("q");
    let areas = await locationsRepository.listAreas({ cityId, query: q, limit: 500 });
    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang") || request.nextUrl.searchParams.get("language"));
    areas = await localizeRecordNames(areas, "areas_locations", "name", lang);
    return apiOk({ areas });
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
      // Unauthenticated / Quick Create fallback
    }

    const body = (await request.json()) as {
      countryId: string;
      stateProvinceId?: string | null;
      districtId?: string | null;
      cityId: string;
      name: string;
      code?: string | null;
      postalCode?: string | null;
    };

    if (!body.cityId || !body.name?.trim()) {
      throw new Error("City and Area Name are required.");
    }

    const area = await locationsRepository.createArea({
      countryId: body.countryId,
      stateProvinceId: body.stateProvinceId ?? null,
      districtId: body.districtId ?? null,
      cityId: body.cityId,
      name: body.name,
      code: body.code ?? null,
      postalCode: body.postalCode ?? null,
      createdBy: session?.userId && isUuid(session.userId) ? session.userId : null,
      originalLanguage: session?.preferredLanguage ?? "en"
    });

    return apiOk({ area });
  } catch (error) {
    return handleApiError(error);
  }
}
