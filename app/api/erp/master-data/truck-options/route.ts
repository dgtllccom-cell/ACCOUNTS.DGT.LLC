import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { withLocalPg } from "@/lib/db/local-postgres";
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
 *
 * Uses withLocalPg (raw SQL) rather than the typed Supabase admin client:
 * erp_truck_master_options is brand new and isn't in the generated
 * lib/supabase/types.ts Database type yet, which the strict typed client
 * would reject at compile time.
 */
export async function GET() {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "shipping_records", action: "read" });

    const options = await withLocalPg(async (sql) => {
      return sql`
        select id, category, code, name_en, name_ur, name_ar, name_fa, name_ps, sort_order
        from public.erp_truck_master_options
        where is_active = true
        order by category asc, sort_order asc;
      `;
    });

    return NextResponse.json({ options: options || [] });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ error: err.message || "Failed to load truck options" }, { status: 500 });
  }
}
