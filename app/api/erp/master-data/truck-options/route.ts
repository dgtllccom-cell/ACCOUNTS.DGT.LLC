import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

/**
 * Truck Registration master-data dropdown options (truck_type, make, color,
 * fuel_type, document_type, contract_type) — backs the "Truck Registration"
 * wizard's Fuel Type / Color / Make / Truck Type / Document Type / Contract
 * Type dropdowns.
 *
 * Root-cause fix: this route did not exist (the directory was empty), so
 * every one of those dropdowns silently rendered with zero options ("--"
 * only) — not a translation or scope problem, a missing endpoint. Reads
 * `erp_truck_master_options` (migration 20260805_multilingual_truck_master.sql),
 * a global (not country/branch-scoped) 5-language lookup table.
 */
export async function GET() {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("erp_truck_master_options")
      .select("id, category, code, name_en, name_ur, name_ar, name_fa, name_ps, sort_order")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ options: data || [] });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message || "Failed to load truck options" }, { status: 500 });
  }
}
