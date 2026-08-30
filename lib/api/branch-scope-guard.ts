import { ApiClientError } from "@/lib/api/response";
import { withLocalPg, getDbUrl } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Business vs agent/logistics branch separation (see migration 20261015).
 *
 * Normal business transaction modules (Purchase, Sales, Local Purchase, Local Sales,
 * Accounting, Ledger, Roznamcha, Cash/Bank, Settlement, Bill Expenses) must only ever
 * ACCEPT a business city branch. `city_branches.is_business_branch = false` marks an
 * agent/shipping/logistics-only branch — these are hidden from the business selector
 * (server-filtered) AND rejected here even if an id is passed directly, so a user
 * cannot bypass the UI by editing a request parameter.
 */

/** Returns true when the city branch is a business branch (or not found — defer to other checks). */
export async function isBusinessCityBranch(cityBranchId: string): Promise<boolean> {
  if (getDbUrl()) {
    const flag = await withLocalPg(async (sql) => {
      const rows = await sql<{ is_business_branch: boolean | null }[]>`
        SELECT is_business_branch FROM public.city_branches
        WHERE id = ${cityBranchId}::uuid AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!rows.length) return "not_found" as const;
      return rows[0].is_business_branch !== false;
    });
    if (flag === "not_found") return true; // let downstream FK / scope checks handle a bad id
    return flag ?? true;
  }

  try {
    const supabase = createSupabaseAdminClient() as any;
    const { data } = await supabase
      .from("city_branches")
      .select("is_business_branch")
      .eq("id", cityBranchId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!data) return true;
    return data.is_business_branch !== false;
  } catch {
    return true; // never block a business save just because the flag lookup failed
  }
}

/**
 * Throws 403 when `cityBranchId` points at an agent/logistics-only branch. No-op for a
 * null id or a genuine business branch. Call this in every business transaction API
 * right after the normal scope authorization.
 */
export async function assertBusinessCityBranch(cityBranchId: string | null | undefined): Promise<void> {
  if (!cityBranchId) return;
  if (!(await isBusinessCityBranch(cityBranchId))) {
    throw new ApiClientError(
      "This branch is a shipping/clearing/agent branch and cannot be used for a business transaction.",
      { status: 403, code: "NON_BUSINESS_BRANCH" }
    );
  }
}
