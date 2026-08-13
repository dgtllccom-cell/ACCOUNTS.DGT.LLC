import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

type WarehouseRow = {
  id: string;
  country_id: string | null;
  state_province_id: string | null;
  district_id: string | null;
  city_id: string | null;
  area_id: string | null;
  owner_name: string | null;
  warehouse_code: string | null;
  warehouse_name: string;
  warehouse_type: string | null;
  full_address: string | null;
  contact_number: string | null;
  status: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  country_name: string | null;
};

type LegacyWarehouseRecord = {
  id: string;
  code: string;
  name: string;
  country_id: string | null;
  location_id: string | null;
  is_active: boolean;
  created_at: string;
  country?: { name: string } | null;
};

function mapWarehouse(row: WarehouseRow): LegacyWarehouseRecord {
  return {
    id: row.id,
    code: row.warehouse_code || row.id.slice(0, 8).toUpperCase(),
    name: row.warehouse_name,
    country_id: row.country_id,
    location_id: row.area_id || row.city_id || row.state_province_id,
    is_active: row.is_active,
    created_at: row.created_at,
    country: row.country_name ? { name: row.country_name } : null
  };
}

async function loadWarehouses(): Promise<LegacyWarehouseRecord[]> {
  const viaPg = await withLocalPg(async (sql) => {
    const rows = await sql<WarehouseRow[]>`
      SELECT
        w.id,
        w.country_id,
        w.state_province_id,
        w.district_id,
        w.city_id,
        w.area_id,
        w.owner_name,
        w.warehouse_code,
        w.warehouse_name,
        w.warehouse_type,
        w.full_address,
        w.contact_number,
        w.status,
        w.description,
        w.is_active,
        w.created_at,
        c.name AS country_name
      FROM public.warehouses w
      LEFT JOIN public.countries c ON c.id = w.country_id
      WHERE w.deleted_at IS NULL
      ORDER BY w.created_at DESC
    `;
    return rows.map(mapWarehouse);
  });
  if (viaPg) return viaPg;
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "warehouses", action: "read" });

    const status = request.nextUrl.searchParams.get("status");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "500");
    const offset = Number(request.nextUrl.searchParams.get("offset") || "0");

    const all = await loadWarehouses();
    const scoped = !session.isSuperAdmin
      ? all.filter((warehouse) => !warehouse.country_id || session.countryIds.includes(warehouse.country_id))
      : all;
    const filtered = scoped.filter((warehouse) => {
      if (status === "Active" && !warehouse.is_active) return false;
      if (status === "Inactive" && warehouse.is_active) return false;
      return true;
    });
    const paged = filtered.slice(offset, offset + limit);
    const active = filtered.filter((item) => item.is_active).length;
    return apiOk({ warehouses: paged, summary: { total: filtered.length, active, inactive: filtered.length - active } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "warehouses", action: "create" });

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const countryId = body.countryId || null;

    if (!name || !code || !countryId) {
      return new Response(JSON.stringify({ error: "name, code, countryId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!session.isSuperAdmin && !session.countryIds.includes(countryId)) {
      return new Response(JSON.stringify({ error: "Not authorized for this country" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    const warehouse = await withLocalPg(async (sql) => {
      const rows = await sql<WarehouseRow[]>`
        INSERT INTO public.warehouses (
          country_id, state_province_id, district_id, city_id, area_id,
          owner_name, warehouse_code, warehouse_name, warehouse_type,
          full_address, contact_number, status, description, is_active, created_at, updated_at
        ) VALUES (
          ${countryId}::uuid,
          ${body.stateProvinceId || null}::uuid,
          ${body.districtId || null}::uuid,
          ${body.cityId || null}::uuid,
          ${body.locationId || null}::uuid,
          ${body.ownerId || body.ownerName || null},
          ${code},
          ${name},
          ${body.warehouseType || "General"},
          ${body.fullAddress || null},
          ${body.contactNumber || null},
          ${body.status || "Active"},
          ${body.description || null},
          ${body.isActive !== false},
          ${new Date().toISOString()},
          ${new Date().toISOString()}
        )
        RETURNING id, country_id, state_province_id, district_id, city_id, area_id, owner_name, warehouse_code, warehouse_name, warehouse_type, full_address, contact_number, status, description, is_active, created_at, NULL::text AS country_name
      `;
      return mapWarehouse(rows[0] as unknown as WarehouseRow);
    });

    return apiOk({ warehouse }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
