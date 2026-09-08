import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";
import { localizeRecordFields, localizeJoinedNames, wantsRawRecord } from "@/lib/i18n/localize-records";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "ports", action: "read" });

    const db = createSupabaseAdminClient() as any;
    const countryId = request.nextUrl.searchParams.get("countryId");
    const transportType = request.nextUrl.searchParams.get("transportType") || request.nextUrl.searchParams.get("type");
    const lang = request.nextUrl.searchParams.get("lang");
    const status = request.nextUrl.searchParams.get("status");

    let qb = db
      .from("ports")
      .select(`
        id, 
        port_name, 
        port_code, 
        transport_type, 
        country_id, 
        is_active, 
        created_at, 
        updated_at,
        country:countries(id, name, iso2)
      `)
      .is("deleted_at", null);

    if (!session.isSuperAdmin && session.countryIds?.length > 0) {
      qb = qb.in("country_id", session.countryIds);
    }

    if (countryId) {
      qb = qb.eq("country_id", countryId);
    }

    if (transportType) {
      qb = qb.eq("transport_type", transportType.toLowerCase());
    }

    if (status === "Active") {
      qb = qb.eq("is_active", true);
    } else if (status === "Inactive") {
      qb = qb.eq("is_active", false);
    }

    const { data, error } = await qb.order("port_name", { ascending: true }).limit(500);

    if (error) throw error;

    // Multilingual: resolve the port name AND the joined country name through the
    // central resolver (record_translations). Replaces the legacy per-language
    // `ports_<lang>` table lookup, which was superseded by record_translations.
    let localizedPorts: any[] = data || [];
    if (!wantsRawRecord(request) && localizedPorts.length > 0) {
      const resolved = await getRequestLanguage(lang);
      localizedPorts = await localizeRecordFields<any>(localizedPorts, "ports", ["port_name"], resolved);
      const withCtry = await localizeJoinedNames<any>(
        localizedPorts.map((p) => ({ ...p, _country_name: p.country?.name })),
        resolved,
        [{ idField: "country_id", nameField: "_country_name", table: "countries" }],
      );
      localizedPorts = withCtry.map((p: any) => ({
        ...p,
        country: p.country ? { ...p.country, name: p._country_name ?? p.country.name } : p.country,
      }));
    }

    // Map backwards-compatible fields
    const mappedPorts = localizedPorts.map((p: any) => ({
      id: p.id,
      code: p.port_code || "",
      name: p.port_name || "",
      port_name: p.port_name || "",
      port_code: p.port_code || "",
      transport_type: p.transport_type || "sea",
      border_type: p.transport_type === "sea" ? "Sea Port" : p.transport_type === "road" ? "Land Border / Checkpoint" : "Airport",
      country_id: p.country_id,
      is_active: p.is_active,
      created_at: p.created_at,
      country: p.country
    }));

    const active = mappedPorts.filter((d: any) => d.is_active).length || 0;
    return apiOk({ 
      ports: mappedPorts, 
      summary: { 
        total: mappedPorts.length, 
        active, 
        inactive: mappedPorts.length - active 
      } 
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "ports", action: "create" });

    const body = await request.json();
    const portName = body.portName || body.name;
    const portCode = body.portCode || body.code;
    const countryId = body.countryId;
    let transportType = body.transportType || "sea";

    if (body.borderType) {
      const bt = String(body.borderType).toLowerCase();
      if (bt.includes("road") || bt.includes("border") || bt.includes("land")) transportType = "road";
      else if (bt.includes("air")) transportType = "air";
      else transportType = "sea";
    }

    if (!portName || !countryId) {
      return new Response(JSON.stringify({ error: "portName and countryId required" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const db = createSupabaseAdminClient() as any;
    const { data, error } = await db
      .from("ports")
      .insert([{ 
        port_name: portName, 
        port_code: portCode || null, 
        country_id: countryId, 
        transport_type: transportType, 
        is_active: body.isActive !== false,
        created_by: session.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select();

    if (error) throw error;
    return apiOk({ port: data?.[0] }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
