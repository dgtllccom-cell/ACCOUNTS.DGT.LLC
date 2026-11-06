import type { ErpSession } from "@/lib/auth/session";
import { ApiClientError } from "@/lib/api/response";
import { getDbUrl, withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Branch = { is_business_branch: boolean | null; operational_domain: string | null };

/** Shared Cash Entry supports Shipping accounting too. Call AFTER scope/permission authorization. */
export async function assertRoznamchaCityBranch(session: ErpSession, cityBranchId: string | null | undefined) {
  if (!cityBranchId) return;
  let branch: Branch | null = null;
  if (getDbUrl()) {
    branch = await withLocalPg(async (sql) => {
      const rows = await sql<Branch[]>`
        SELECT is_business_branch, operational_domain FROM public.city_branches
        WHERE id = ${cityBranchId}::uuid AND deleted_at IS NULL LIMIT 1
      `;
      return rows[0] ?? null;
    });
  } else {
    const { data, error } = await (createSupabaseAdminClient() as any)
      .from("city_branches").select("is_business_branch, operational_domain")
      .eq("id", cityBranchId).is("deleted_at", null).maybeSingle();
    if (error) throw new Error(error.message);
    branch = data;
  }
  if (!branch) throw new ApiClientError("The selected branch is unavailable.", { status: 403 });

  const domains = session.operationalDomains ?? ["business"];
  const allowed = (domain: string) => session.isSuperAdmin || domains.includes("both") || domains.includes(domain);
  if (branch.operational_domain === "shipping" && allowed("shipping")) return;
  if (branch.is_business_branch !== false && branch.operational_domain !== "shipping" && allowed("business")) return;
  throw new ApiClientError("The selected branch is outside your accounting domain.", { status: 403, code: "BRANCH_DOMAIN_FORBIDDEN" });
}
