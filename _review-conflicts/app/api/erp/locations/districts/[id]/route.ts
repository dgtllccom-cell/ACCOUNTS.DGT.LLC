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
      throw new Error("Invalid district id");
    }

    const district = await locationsRepository.getDistrictById(id);
    if (!session.isSuperAdmin && !session.countryIds.includes(district.country_id)) {
      return apiOk({ district: null });
    }

    return apiOk({ district });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    if (!isUuid(id)) {
      throw new Error("Invalid district id");
    }

    const body = (await request.json()) as {
      name?: string | null;
      code?: string | null;
      isActive?: boolean | null;
    };

    const district = await locationsRepository.getDistrictById(id);
    if (!session.isSuperAdmin && !session.countryIds.includes(district.country_id)) {
      throw new Error("Country scope is not allowed.");
    }

    const updated = await locationsRepository.updateDistrict({
      districtId: id,
      name: body.name ?? undefined,
      code: body.code ?? undefined,
      isActive: body.isActive ?? undefined
    });

    return apiOk({ district: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await context.params;
    if (!isUuid(id)) {
      throw new Error("Invalid district id");
    }

    const district = await locationsRepository.getDistrictById(id);
    if (!session.isSuperAdmin && !session.countryIds.includes(district.country_id)) {
      throw new Error("Country scope is not allowed.");
    }

    await locationsRepository.deleteDistrict(id);
    return apiOk({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
