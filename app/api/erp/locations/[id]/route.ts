import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

    const db = createSupabaseAdminClient();

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

    return apiOk({ location: data });
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

    const db = createSupabaseAdminClient();

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

    const db = createSupabaseAdminClient();

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
