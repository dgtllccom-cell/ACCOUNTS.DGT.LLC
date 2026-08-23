import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

/**
 * Product Units master — list + create.
 * Follows the ERP master-data convention (requireErpSession + admin client +
 * camelCase mapping) and the centralized multilingual write-time helper.
 * Table: product_units (id, unit_code, unit_name, base_unit_code,
 *        conversion_factor, is_active, created_by, timestamps, deleted_at)
 */
export async function GET() {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_units", action: "read" });
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("product_units")
      .select("id, unit_code, unit_name, base_unit_code, conversion_factor, is_active, created_at")
      .is("deleted_at", null)
      .order("unit_name", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const formatted = (data || []).map((r: any) => ({
      id: r.id,
      unitCode: r.unit_code,
      unitName: r.unit_name,
      baseUnitCode: r.base_unit_code,
      conversionFactor: r.conversion_factor != null ? Number(r.conversion_factor) : 1,
      isActive: r.is_active,
    }));
    return NextResponse.json({ units: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "product_units", action: "create" });
    const body = await req.json();

    const unitCode = typeof body.unitCode === "string" ? body.unitCode.trim().toUpperCase() : "";
    const unitName = typeof body.unitName === "string" ? body.unitName.trim() : "";
    if (!unitCode || !unitName) {
      return NextResponse.json({ error: "unitCode and unitName are required" }, { status: 400 });
    }
    const conversionFactor = body.conversionFactor != null ? Number(body.conversionFactor) : 1;
    if (!(conversionFactor > 0)) {
      return NextResponse.json({ error: "conversionFactor must be greater than 0" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("product_units")
      .insert({
        unit_code: unitCode,
        unit_name: unitName,
        base_unit_code: body.baseUnitCode ? String(body.baseUnitCode).trim().toUpperCase() : null,
        conversion_factor: conversionFactor,
        is_active: true,
        created_by: session.userId,
      })
      .select("id, unit_code, unit_name, base_unit_code, conversion_factor, is_active")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Centralized 5-language write (fire-and-forget; never blocks the request).
    void translateMasterRecord("product_units", data.id, { unit_name: data.unit_name, unit_code: data.unit_code }, session.preferredLanguage ?? "en", session.userId);

    return NextResponse.json({
      id: data.id,
      unitCode: data.unit_code,
      unitName: data.unit_name,
      baseUnitCode: data.base_unit_code,
      conversionFactor: data.conversion_factor != null ? Number(data.conversion_factor) : 1,
      isActive: data.is_active,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
