import { NextRequest } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  limit: z.coerce.number().default(100),
  offset: z.coerce.number().default(0),
  search: z.string().optional(),
  countryId: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();

    authorizeApiScope(session, {
      resource: "locations",
      action: "read",
    });

    const query = querySchema.parse({
      limit: request.nextUrl.searchParams.get("limit"),
      offset: request.nextUrl.searchParams.get("offset"),
      search: request.nextUrl.searchParams.get("search"),
      countryId: request.nextUrl.searchParams.get("countryId"),
      status: request.nextUrl.searchParams.get("status"),
      fromDate: request.nextUrl.searchParams.get("fromDate"),
      toDate: request.nextUrl.searchParams.get("toDate"),
    });

    const db = createSupabaseAdminClient();

    // Build query - REAL DATA ONLY
    let qb = db
      .from("locations")
      .select(
        `id, country_id, state_province_id, district_id, city_id, name, code, postal_code,
         is_active, created_at, updated_at, country:countries(name),
         state:state_provinces(name), district:districts(name), city:cities(name)`
      );

    // Apply scope filters
    if (!session.isSuperAdmin && session.countryIds.length > 0) {
      qb = qb.in("country_id", session.countryIds);
    }

    // Apply country filter
    if (query.countryId && query.countryId !== "all") {
      qb = qb.eq("country_id", query.countryId);
    }

    // Apply status filter
    if (query.status) {
      qb = qb.eq("is_active", query.status === "Active");
    }

    // Apply search
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      qb = qb.or(
        `name.ilike.%${searchLower}%,code.ilike.%${searchLower}%`
      );
    }

    // Apply date range
    if (query.fromDate) {
      qb = qb.gte("created_at", query.fromDate);
    }
    if (query.toDate) {
      qb = qb.lte("created_at", query.toDate);
    }

    // Sort and limit
    const { data, error, count } = await qb
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) throw error;

    // Return empty array if no data (NOT sample data)
    if (!data || data.length === 0) {
      return apiOk({
        locations: [],
        summary: { total: 0, active: 0, inactive: 0 },
      });
    }

    // Calculate summary
    const active = data.filter((d: any) => d.is_active).length;
    const inactive = data.filter((d: any) => !d.is_active).length;

    return apiOk({
      locations: data,
      summary: { total: count || 0, active, inactive },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();

    authorizeApiScope(session, {
      resource: "locations",
      action: "create",
    });

    const body = await request.json();
    const { countryId, stateId, districtId, cityId, name, code, postalCode, isActive } = body;

    if (!name || !countryId) {
      return new Response(JSON.stringify({ error: "name and countryId are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Enforce scope - non-admin cannot create for other countries
    if (!session.isSuperAdmin && !session.countryIds.includes(countryId)) {
      return new Response(JSON.stringify({ error: "Not authorized for this country" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = createSupabaseAdminClient();

    const { data, error } = await db
      .from("locations")
      .insert([
        {
          country_id: countryId,
          state_province_id: stateId || null,
          district_id: districtId || null,
          city_id: cityId || null,
          name,
          code: code || null,
          postal_code: postalCode || null,
          is_active: isActive !== false,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) throw error;

    return apiOk({ location: data?.[0] }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
