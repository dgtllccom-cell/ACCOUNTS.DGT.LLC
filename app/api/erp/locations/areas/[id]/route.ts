import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { locationsRepository } from "@/lib/repositories/locations-repository";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin && !session.countryIds.length) throw new Error("Location write is not allowed.");

    const { id } = await params;
    const body = (await request.json()) as { name?: string | null; code?: string | null; isActive?: boolean | null };
    const area = await locationsRepository.updateArea({
      areaId: id,
      name: body.name,
      code: body.code,
      isActive: body.isActive
    });

    if (!session.isSuperAdmin && !session.countryIds.includes(area.country_id)) {
      throw new Error("Country scope is not allowed.");
    }

    return apiOk({ area });
  } catch (error) {
    return handleApiError(error);
  }
}
