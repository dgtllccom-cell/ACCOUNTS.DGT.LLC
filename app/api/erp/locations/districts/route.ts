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
    const stateProvinceId = request.nextUrl.searchParams.get("stateProvinceId");
    if (!stateProvinceId) {
      return apiOk({ districts: [] });
    }

    const q = request.nextUrl.searchParams.get("q");
    const districts = await locationsRepository.listDistricts({
      stateProvinceId,
      query: q,
      limit: 500
    });

    return apiOk({ districts });
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
      stateProvinceId: string;
      name: string;
      code?: string | null;
    };

    if (!body.countryId || !body.stateProvinceId || !body.name?.trim()) {
      throw new Error("countryId, stateProvinceId and name are required");
    }

    if (!session.isSuperAdmin && !session.countryIds.includes(body.countryId)) {
      throw new Error("Country scope is not allowed.");
    }

    const district = await locationsRepository.createDistrict({
      countryId: body.countryId,
      stateProvinceId: body.stateProvinceId,
      name: body.name,
      code: body.code ?? null,
      createdBy: isUuid(session.userId) ? session.userId : null
    });

    return apiOk({ district });
  } catch (error) {
    return handleApiError(error);
  }
}
