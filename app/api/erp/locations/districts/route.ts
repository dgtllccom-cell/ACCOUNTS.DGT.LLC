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
    const stateProvinceId = request.nextUrl.searchParams.get("stateProvinceId");
    if (!countryId && !stateProvinceId) {
      return apiOk({ districts: [] });
    }

    const q = request.nextUrl.searchParams.get("q");
    let districts: any[] = [];

    try {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createSupabaseAdminClient() as any;
      let query = supabase
        .from("districts")
        .select("id, country_id, state_province_id, name, code, postal_code, phone_area_code, is_active")
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (stateProvinceId) {
        query = query.eq("state_province_id", stateProvinceId);
      } else if (countryId) {
        const resolvedCountryId = await locationsRepository.resolveCountryUuid(countryId);
        query = query.eq("country_id", resolvedCountryId);
      }

      if (q) {
        query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
      }

      const { data } = await query.limit(500);
      if (data && data.length > 0) {
        districts = data;
      }
    } catch {
      // Fallback to repo if needed
    }

    if (!districts.length && stateProvinceId) {
      districts = await locationsRepository.listDistricts({
        stateProvinceId,
        query: q,
        limit: 500
      }).catch(() => []);
    }

    const lang = await getRequestLanguage();
    districts = await localizeRecordNames(districts, "districts", "name", lang);

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

    const resolvedCountryId = await locationsRepository.resolveCountryUuid(body.countryId);
    const resolvedStateId = await locationsRepository.resolveStateUuid(body.stateProvinceId, resolvedCountryId);

    if (!session.isSuperAdmin && !session.countryIds.includes(body.countryId) && !session.countryIds.includes(resolvedCountryId)) {
      throw new Error("Country scope is not allowed.");
    }

    const district = await locationsRepository.createDistrict({
      countryId: resolvedCountryId,
      stateProvinceId: resolvedStateId,
      name: body.name,
      code: body.code ?? null,
      createdBy: isUuid(session.userId) ? session.userId : null,
      originalLanguage: session.preferredLanguage ?? "en"
    });

    return apiOk({ district });
  } catch (error) {
    return handleApiError(error);
  }
}
