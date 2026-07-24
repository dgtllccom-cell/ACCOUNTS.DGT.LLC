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
    const countryId = request.nextUrl.searchParams.get("countryId");
    if (!countryId) {
      return apiOk({ cities: [] });
    }

    if (!session.isSuperAdmin && !session.countryIds.includes(countryId)) {
      return apiOk({ cities: [] });
    }

    const stateProvinceId = request.nextUrl.searchParams.get("stateProvinceId");
    const districtId = request.nextUrl.searchParams.get("districtId");
    const q = request.nextUrl.searchParams.get("q");
    const cities = await locationsRepository.listCities({
      countryId,
      stateProvinceId: stateProvinceId ?? null,
      districtId: districtId ?? null,
      query: q,
      limit: 500
    });

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

    if (!session.isSuperAdmin && !session.countryIds.includes(body.countryId)) {
      throw new Error("Country scope is not allowed.");
    }

    const city = await locationsRepository.createCity({
      countryId: body.countryId,
      stateProvinceId: body.stateProvinceId ?? null,
      districtId: body.districtId ?? null,
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
