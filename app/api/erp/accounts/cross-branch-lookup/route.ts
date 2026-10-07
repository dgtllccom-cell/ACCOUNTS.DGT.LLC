import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { hasRolePermission, ErpPermissionError } from "@/lib/permissions/middleware";
import { withReadPg } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestLanguage } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type RestrictedCrossBranchAccount = {
  id: string;
  code: string;
  name: string;
  accountNumber: string | null;
  customerNumber: string | null;
  manualReferenceNumber: string | null;
  customerName: string | null;
  currency: string;
  countryId: string | null;
  countryName: string | null;
  countryBranchId: string | null;
  cityBranchId: string | null;
  owningBranchId: string | null;
  owningBranchName: string | null;
  owningBranchCode: string | null;
  cityName: string | null;
  ledgerId: string | null;
  ledgerCode: string | null;
  ledgerName: string | null;
  isOwnBranch: boolean;
  // Strictly stripped: balance and financial ledger data are never exposed
  currentBalance: null;
};

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();

    // 1. Business Domain Enforcement
    // Cross-branch recipient lookup is restricted to authorized Business users.
    // Shipping-only accounts are strictly forbidden.
    const domains = session.operationalDomains ?? ["business"];
    const isShippingOnly = !session.isSuperAdmin && domains.length === 1 && domains[0] === "shipping";
    if (isShippingOnly) {
      throw new ErpPermissionError(
        "Cross-branch account lookup is restricted to authorized Business users. Shipping-only accounts are not permitted."
      );
    }

    // 2. Explicit Permission Check
    // Explicit permission separate from general ledger-read access.
    const hasLookupPermission =
      session.isSuperAdmin ||
      hasRolePermission(session, "cross_branch_payment", "lookup") ||
      hasRolePermission(session, "accounts", "cross_branch_lookup");

    if (!hasLookupPermission) {
      throw new ErpPermissionError(
        "Missing permission: cross_branch_payment:lookup. You are not authorized to perform cross-branch account lookup."
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const lang = await getRequestLanguage(searchParams.get("lang"));
    const q = (searchParams.get("q") || "").trim();
    const requestedCountryId = (searchParams.get("countryId") || "").trim();

    // 3. Country Scope Resolution & Isolation
    // Only same-country lookup is permitted. Cross-country lookup is blocked.
    let effectiveCountryId: string | null = null;
    if (session.isSuperAdmin) {
      effectiveCountryId = requestedCountryId || session.countryIds[0] || null;
    } else {
      effectiveCountryId = session.countryIds[0] || null;
      if (requestedCountryId && !session.countryIds.includes(requestedCountryId)) {
        throw new ErpPermissionError(
          "Cross-country account lookup is strictly prohibited. You may only search accounts within your assigned country."
        );
      }
    }

    if (!effectiveCountryId) {
      throw new ErpPermissionError("No authorized country scope could be determined for your session.");
    }

    if (!q) {
      return apiOk({ accounts: [], total: 0 });
    }

    const likeValue = `%${q}%`;
    const callerCityBranchIds = session.cityBranchIds ?? [];
    const callerCountryBranchIds = session.countryBranchIds ?? [];

    // Query restricted fields only via Postgres (or Supabase fallback)
    const rows = await withReadPg(async (sql) => {
      return sql`
        select
          ea.id,
          ea.code,
          ea.name,
          ea.account_number,
          ea.manual_reference_number,
          ea.customer_number,
          ea.currency,
          ea.country_id,
          ea.country_branch_id,
          ea.city_branch_id,
          co.name as country_name,
          coalesce(cb.name, mb.name, 'Main Branch') as owning_branch_name,
          coalesce(cb.code, mb.code, '') as owning_branch_code,
          cb.city_name,
          l.id as ledger_id,
          l.code as ledger_code,
          l.name as ledger_name,
          c.full_name as customer_name
        from public.enterprise_accounts ea
        left join public.ledgers l on l.enterprise_account_id = ea.id and l.deleted_at is null and l.is_active is not false
        left join public.city_branches cb on cb.id = ea.city_branch_id and cb.deleted_at is null
        left join public.country_branches mb on mb.id = ea.country_branch_id and mb.deleted_at is null
        left join public.countries co on co.id = ea.country_id
        left join public.customers c on c.id = ea.customer_id and c.deleted_at is null
        where ea.deleted_at is null
          and ea.is_active is not false
          and ea.country_id = ${effectiveCountryId}::uuid
          and coalesce(ea.operational_domain, 'business') in ('business', 'both')
          and (
            ea.code ilike ${likeValue}
            or ea.name ilike ${likeValue}
            or ea.account_number ilike ${likeValue}
            or ea.manual_reference_number ilike ${likeValue}
            or ea.customer_number ilike ${likeValue}
            or c.full_name ilike ${likeValue}
          )
        order by ea.name asc
        limit 50
      `;
    });

    let records: any[] = rows ?? [];

    if (!records.length) {
      // Fallback via Supabase admin if pg read yielded nothing
      const admin = createSupabaseAdminClient() as any;
      const { data } = await admin
        .from("enterprise_accounts")
        .select(`
          id, code, name, account_number, manual_reference_number, customer_number, currency,
          country_id, country_branch_id, city_branch_id,
          countries(name),
          city_branches(name, code, city_name),
          country_branches(name, code),
          ledgers(id, code, name),
          customers(full_name)
        `)
        .eq("country_id", effectiveCountryId)
        .is("deleted_at", null)
        .or(`code.ilike.%${q}%,name.ilike.%${q}%,account_number.ilike.%${q}%,manual_reference_number.ilike.%${q}%,customer_number.ilike.%${q}%`)
        .limit(50);

      records = (data || []).map((row: any) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        account_number: row.account_number,
        manual_reference_number: row.manual_reference_number,
        customer_number: row.customer_number,
        currency: row.currency,
        country_id: row.country_id,
        country_branch_id: row.country_branch_id,
        city_branch_id: row.city_branch_id,
        country_name: row.countries?.name || null,
        owning_branch_name: row.city_branches?.name || row.country_branches?.name || null,
        owning_branch_code: row.city_branches?.code || row.country_branches?.code || null,
        city_name: row.city_branches?.city_name || null,
        ledger_id: row.ledgers?.[0]?.id || null,
        ledger_code: row.ledgers?.[0]?.code || null,
        ledger_name: row.ledgers?.[0]?.name || null,
        customer_name: row.customers?.full_name || null
      }));
    }

    // Format restricted account projection: balance, ledger history, transactions and reports are strictly excluded
    const accounts: RestrictedCrossBranchAccount[] = records.map((r: any) => {
      const isOwn =
        session.isSuperAdmin
          ? false
          : callerCityBranchIds.length > 0
          ? Boolean(r.city_branch_id && callerCityBranchIds.includes(r.city_branch_id))
          : callerCountryBranchIds.length > 0
          ? Boolean(r.country_branch_id && callerCountryBranchIds.includes(r.country_branch_id))
          : false;

      return {
        id: r.id,
        code: r.code,
        name: r.name,
        accountNumber: r.account_number ?? r.code,
        customerNumber: r.customer_number ?? null,
        manualReferenceNumber: r.manual_reference_number ?? null,
        customerName: r.customer_name ?? null,
        currency: r.currency || "PKR",
        countryId: r.country_id,
        countryName: r.country_name,
        countryBranchId: r.country_branch_id,
        cityBranchId: r.city_branch_id,
        owningBranchId: r.city_branch_id || r.country_branch_id,
        owningBranchName: r.owning_branch_name || "Unknown Branch",
        owningBranchCode: r.owning_branch_code,
        cityName: r.city_name,
        ledgerId: r.ledger_id,
        ledgerCode: r.ledger_code,
        ledgerName: r.ledger_name,
        isOwnBranch: isOwn,
        currentBalance: null // NEVER expose balance
      };
    });

    return apiOk({
      accounts,
      total: accounts.length,
      countryId: effectiveCountryId
    });
  } catch (error) {
    return handleApiError(error);
  }
}
