import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";

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
    const areas = await locationsRepository.listAreas({ cityId, query: q, limit: 500 });
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

    if (!body.countryId || !body.cityId || !body.name?.trim()) {
      throw new Error("countryId, cityId and name are required");
    }

    if (session && !session.isSuperAdmin && session.countryIds?.length > 0 && !session.countryIds.includes(body.countryId)) {
      throw new Error("Country scope is not allowed.");
    }

    const area = await locationsRepository.createArea({
      countryId: body.countryId,
      stateProvinceId: body.stateProvinceId ?? null,
      districtId: body.districtId ?? null,
      cityId: body.cityId,
      name: body.name,
      code: body.code ?? null,
      postalCode: body.postalCode ?? null,
      createdBy: isUuid(session.userId) ? session.userId : null
    });

    return apiOk({ area });
  } catch (error) {
    return handleApiError(error);
  }
}
