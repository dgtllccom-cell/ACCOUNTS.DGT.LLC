import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeJoinedNames } from "@/lib/i18n/localize-records";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    authorizeApiScope(session, {
      resource: "locations",
      action: "read",
    });

    const db = createSupabaseAdminClient() as any;

    const { data, error } = await db
      .from("locations")
      .select(
        `id, country_id, state_province_id, district_id, city_id, name, code, postal_code,
         is_active, created_at, updated_at, country:countries(name),
         state:state_provinces(name), district:districts(name), city:cities(name)`
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Location not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify scope
    if (!session.isSuperAdmin && !session.countryIds.includes(data.country_id)) {
      return new Response(JSON.stringify({ error: "Not authorized for this location" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const lang = await getRequestLanguage(request.nextUrl.searchParams.get("lang"));
    let localizedData: any = data;
    try {
      const flat = {
        country_id: data.country_id, countryNameFlat: data.country?.name,
        state_province_id: data.state_province_id, stateNameFlat: data.state?.name,
        district_id: data.district_id, districtNameFlat: data.district?.name,
        city_id: data.city_id, cityNameFlat: data.city?.name
      };
      const [localizedFlat] = await localizeJoinedNames<any>([flat], lang, [
        { idField: "country_id", nameField: "countryNameFlat", table: "countries", field: "name" },
        { idField: "state_province_id", nameField: "stateNameFlat", table: "states_provinces", field: "name" },
        { idField: "district_id", nameField: "districtNameFlat", table: "districts", field: "name" },
        { idField: "city_id", nameField: "cityNameFlat", table: "cities", field: "name" }
      ]);
      localizedData = {
        ...data,
        country: data.country ? { ...data.country, name: localizedFlat.countryNameFlat } : data.country,
        state: data.state ? { ...data.state, name: localizedFlat.stateNameFlat } : data.state,
        district: data.district ? { ...data.district, name: localizedFlat.districtNameFlat } : data.district,
        city: data.city ? { ...data.city, name: localizedFlat.cityNameFlat } : data.city
      };
    } catch {
      // keep original names on failure
    }

    return apiOk({ location: localizedData });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const body = await request.json();
    const { name, code, postalCode, isActive, stateId, districtId, cityId } = body;

    authorizeApiScope(session, {
      resource: "locations",
      action: "update",
    });

    const db = createSupabaseAdminClient() as any;

    // Get existing location to verify scope
    const { data: existing, error: getError } = await db
      .from("locations")
      .select("country_id")
      .eq("id", id)
      .single();

    if (getError || !existing) {
      return new Response(JSON.stringify({ error: "Location not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify scope
    if (!session.isSuperAdmin && !session.countryIds.includes(existing.country_id)) {
      return new Response(JSON.stringify({ error: "Not authorized for this location" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await db
      .from("locations")
      .update({
        name,
        code: code || null,
        postal_code: postalCode || null,
        state_province_id: stateId || null,
        district_id: districtId || null,
        city_id: cityId || null,
        is_active: isActive !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return apiOk({ location: data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;

    authorizeApiScope(session, {
      resource: "locations",
      action: "delete",
    });

    const db = createSupabaseAdminClient() as any;

    // Get existing location to verify scope
    const { data: existing, error: getError } = await db
      .from("locations")
      .select("country_id")
      .eq("id", id)
      .single();

    if (getError || !existing) {
      return new Response(JSON.stringify({ error: "Location not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify scope
    if (!session.isSuperAdmin && !session.countryIds.includes(existing.country_id)) {
      return new Response(JSON.stringify({ error: "Not authorized for this location" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await db.from("locations").delete().eq("id", id);

    if (error) throw error;

    return apiOk({ message: "Location deleted successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
