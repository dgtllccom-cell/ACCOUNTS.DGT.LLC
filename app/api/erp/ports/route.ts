import { NextRequest } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { apiOk, handleApiError } from "@/lib/api/response";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

    // Multilingual Translation Mapping if lang specified
    let localizedPorts = data || [];
    if (lang && ["ur", "ar", "fa", "ps"].includes(lang.toLowerCase())) {
      const transTable = `ports_${lang.toLowerCase()}`;
      try {
        const { data: transData } = await db
          .from(transTable)
          .select("record_id, translated_text")
          .in("record_id", (data || []).map((p: any) => p.id));

        const transMap = new Map((transData || []).map((t: any) => [t.record_id, t.translated_text]));
        localizedPorts = (data || []).map((p: any) => ({
          ...p,
          port_name: transMap.get(p.id) || p.port_name
        }));
      } catch (e) {
        // Fallback to default port_name
      }
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
