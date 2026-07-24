import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    if (!isUuid(id)) {
      throw new Error("Invalid city id");
    }

    const city = await locationsRepository.getCityById(id);
    if (!session.isSuperAdmin && !session.countryIds.includes(city.country_id)) {
      return apiOk({ city: null });
    }

    return apiOk({ city });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    if (!isUuid(id)) {
      throw new Error("Invalid city id");
    }

    const body = (await request.json()) as {
      name?: string | null;
      code?: string | null;
      zipCode?: string | null;
      isActive?: boolean | null;
    };

    const city = await locationsRepository.getCityById(id);
    if (!session.isSuperAdmin && !session.countryIds.includes(city.country_id)) {
      throw new Error("Country scope is not allowed.");
    }

    const updated = await locationsRepository.updateCity({
      cityId: id,
      name: body.name ?? undefined,
      code: body.code ?? undefined,
      zipCode: body.zipCode ?? undefined,
      isActive: body.isActive ?? undefined,
      updatedBy: isUuid(session.userId) ? session.userId : null
    });

    return apiOk({ city: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    if (!isUuid(id)) {
      throw new Error("Invalid city id");
    }

    const city = await locationsRepository.getCityById(id);
    if (!session.isSuperAdmin && !session.countryIds.includes(city.country_id)) {
      throw new Error("Country scope is not allowed.");
    }

    await locationsRepository.deleteCity(id);
    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
