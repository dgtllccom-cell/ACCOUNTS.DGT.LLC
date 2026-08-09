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
      // Unauthenticated dropdown access
    }
    const countryId = request.nextUrl.searchParams.get("countryId");
    if (!countryId) {
      return apiOk({ states: [] });
    }

    const q = request.nextUrl.searchParams.get("q");
    let states = await locationsRepository.listStates({ countryId, query: q, limit: 500 });
    const lang = await getRequestLanguage();
    states = await localizeRecordNames(states, "states_provinces", "name", lang);
    return apiOk({ states });
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

    const body = (await request.json()) as { countryId: string; name: string; code?: string | null };
    if (!body.countryId || !body.name?.trim()) {
      throw new Error("countryId and name are required");
    }

    const resolvedCountryId = await locationsRepository.resolveCountryUuid(body.countryId);

    if (!session.isSuperAdmin && !session.countryIds.includes(body.countryId) && !session.countryIds.includes(resolvedCountryId)) {
      throw new Error("Country scope is not allowed.");
    }

    const state = await locationsRepository.createState({
      countryId: resolvedCountryId,
      name: body.name,
      code: body.code ?? null,
      createdBy: isUuid(session.userId) ? session.userId : null
    });

    return apiOk({ state });
  } catch (error) {
    return handleApiError(error);
  }
}
