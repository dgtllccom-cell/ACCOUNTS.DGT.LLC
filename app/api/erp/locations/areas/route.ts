import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const cityId = request.nextUrl.searchParams.get("cityId");
    if (!cityId) {
      return apiOk({ areas: [] });
    }

    if (!session.isSuperAdmin) {
      const city = await locationsRepository.getCityById(cityId);
      if (!session.countryIds.includes(city.country_id)) {
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
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.countryIds.length) {
      throw new Error("Location write is not allowed.");
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

    if (!session.isSuperAdmin && !session.countryIds.includes(body.countryId)) {
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
