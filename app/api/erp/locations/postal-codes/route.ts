import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const countryId = request.nextUrl.searchParams.get("countryId");
    if (!countryId) return apiOk({ postalCodes: [] });

    if (!session.isSuperAdmin && !session.countryIds.includes(countryId)) {
      return apiOk({ postalCodes: [] });
    }

    const stateProvinceId = request.nextUrl.searchParams.get("stateProvinceId");
    const districtId = request.nextUrl.searchParams.get("districtId");
    const cityId = request.nextUrl.searchParams.get("cityId");
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 100), 1), 500);
    const supabase = createSupabaseAdminClient() as any;

    let query = supabase
      .from("postal_codes")
      .select("id, country_id, state_province_id, district_id, city_id, postal_code, place_name, admin1_name, admin1_code, admin2_name, admin2_code, admin3_name, admin3_code, latitude, longitude, accuracy")
      .eq("country_id", countryId)
      .is("deleted_at", null)
      .order("postal_code", { ascending: true })
      .order("place_name", { ascending: true });

    if (cityId) query = query.eq("city_id", cityId);
    else if (districtId) query = query.eq("district_id", districtId);
    else if (stateProvinceId) query = query.eq("state_province_id", stateProvinceId);

    if (q) query = query.or(`postal_code.ilike.%${q}%,place_name.ilike.%${q}%,admin1_name.ilike.%${q}%,admin2_name.ilike.%${q}%,admin3_name.ilike.%${q}%`);

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);

    return apiOk({ postalCodes: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
