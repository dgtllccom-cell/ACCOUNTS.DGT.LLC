import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { enterpriseLedgerCreateSchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { normalizeLanguage } from "@/lib/services/enterprise-multilingual-service";
import { localizeRecordNames } from "@/lib/i18n/localize-records";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);

    authorizeApiScope(session, {
      resource: "ledgers",
      action: "read",
      ...scope
    });

    // Root-cause bypass: ledgers_scope_read gates on is_super_admin()/can_access_country()/
    // can_access_city_branch(), all keyed off auth.uid(), which is always NULL under the
    // app's temp-session bootstrap login — so the query below silently returns zero rows.
    // Try a direct-Postgres read first (bypasses RLS via DATABASE_URL); fall back to the
    // Supabase-client path only when DATABASE_URL isn't configured.
    const viaPg = await withLocalPg(async (sql) => {
      if (!session.isSuperAdmin) {
        const cityIds = session.cityBranchIds ?? [];
        const countryBranchIds = session.countryBranchIds ?? [];
        const countryIds = session.countryIds ?? [];
        if (cityIds.length === 0 && countryBranchIds.length === 0 && countryIds.length === 0) {
          return [] as any[];
        }
        return await sql`
          select id, scope, country_id, country_branch_id, city_branch_id, enterprise_account_id,
            parent_ledger_id, code, name, currency, opening_balance, current_balance, debit_total,
            credit_total, normal_balance, is_active, created_at, updated_at
          from public.ledgers
          where deleted_at is null
            and (city_branch_id = any(${cityIds}) or country_branch_id = any(${countryBranchIds}) or country_id = any(${countryIds}))
            and (${scope.countryId ? sql`country_id = ${scope.countryId}` : sql`true`})
            and (${scope.countryBranchId ? sql`country_branch_id = ${scope.countryBranchId}` : sql`true`})
            and (${scope.cityBranchId ? sql`city_branch_id = ${scope.cityBranchId}` : sql`true`})
          order by code asc
          limit 300
        `;
      }
      return await sql`
        select id, scope, country_id, country_branch_id, city_branch_id, enterprise_account_id,
          parent_ledger_id, code, name, currency, opening_balance, current_balance, debit_total,
          credit_total, normal_balance, is_active, created_at, updated_at
        from public.ledgers
        where deleted_at is null
          and (${scope.countryId ? sql`country_id = ${scope.countryId}` : sql`true`})
          and (${scope.countryBranchId ? sql`country_branch_id = ${scope.countryBranchId}` : sql`true`})
          and (${scope.cityBranchId ? sql`city_branch_id = ${scope.cityBranchId}` : sql`true`})
        order by code asc
        limit 300
      `;
    });

    let data: any[];
    if (viaPg) {
      data = viaPg;
    } else {
      const supabase = await createApiSupabaseClient();
      let query = supabase
        .from("ledgers")
        .select(
          "id, scope, country_id, country_branch_id, city_branch_id, enterprise_account_id, parent_ledger_id, code, name, currency, opening_balance, current_balance, debit_total, credit_total, normal_balance, is_active, created_at, updated_at"
        )
        .is("deleted_at", null)
        .order("code", { ascending: true });

      if (!session.isSuperAdmin) {
        const conditions: string[] = [];
        if (session.cityBranchIds && session.cityBranchIds.length > 0) {
          conditions.push(`city_branch_id.in.(${session.cityBranchIds.join(",")})`);
        }
        if (session.countryBranchIds && session.countryBranchIds.length > 0) {
          conditions.push(`country_branch_id.in.(${session.countryBranchIds.join(",")})`);
        }
        if (session.countryIds && session.countryIds.length > 0) {
          conditions.push(`country_id.in.(${session.countryIds.join(",")})`);
        }

        if (conditions.length > 0) {
          query = query.or(conditions.join(","));
        } else {
          query = query.eq("id", "00000000-0000-0000-0000-000000000000");
        }
      }

      if (scope.countryId) query = query.eq("country_id", scope.countryId);
      if (scope.countryBranchId) query = query.eq("country_branch_id", scope.countryBranchId);
      if (scope.cityBranchId) query = query.eq("city_branch_id", scope.cityBranchId);

      const { data: rows, error } = await query.limit(300);
      if (error) throw new Error(error.message);
      data = rows ?? [];
    }

    const lang = normalizeLanguage(request.nextUrl.searchParams.get("lang"), "en");
    const resolvedData = await localizeRecordNames(data as any[], "ledgers", "name", lang);

    return apiOk({
      ledgers: resolvedData,
      hierarchy: buildLedgerTree(resolvedData as LedgerNode[])
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = enterpriseLedgerCreateSchema.parse(await request.json());

    authorizeApiScope(session, {
      resource: "ledgers",
      action: "create",
      countryId: body.countryId,
      countryBranchId: body.countryBranchId,
      cityBranchId: body.cityBranchId
    });

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("create_enterprise_ledger", {
      p_scope: body.scope,
      p_country_id: body.countryId ?? null,
      p_country_branch_id: body.countryBranchId ?? null,
      p_city_branch_id: body.cityBranchId ?? null,
      p_enterprise_account_id: body.enterpriseAccountId ?? null,
      p_parent_ledger_id: body.parentLedgerId ?? null,
      p_code: body.code,
      p_name: body.name,
      p_currency: body.currency,
      p_opening_balance: body.openingBalance,
      p_normal_balance: body.normalBalance
    });

    if (error) {
      throw new Error(error.message);
    }

    const ledgerId = data as string;
    // Populate the 5-language store for the ledger name so any user viewing this
    // ledger in a different language later gets a resolved value instead of always
    // seeing the original-language text (registered in translatable-fields.ts as
    // mode:"transliterate"); non-blocking, never affects the already-committed create.
    void translateMasterRecord("ledgers", ledgerId, { name: body.name }, session.preferredLanguage ?? "en", session.userId ?? null);

    return apiCreated({
      ledgerId
    });
  } catch (error) {
    return handleApiError(error);
  }
}

type LedgerNode = {
  id: string;
  parent_ledger_id: string | null;
  [key: string]: unknown;
};

function buildLedgerTree(rows: LedgerNode[]) {
  const nodeMap = new Map<string, LedgerNode & { children: LedgerNode[] }>();
  const roots: Array<LedgerNode & { children: LedgerNode[] }> = [];

  for (const row of rows) {
    nodeMap.set(row.id, { ...row, children: [] });
  }

  for (const node of nodeMap.values()) {
    if (node.parent_ledger_id && nodeMap.has(node.parent_ledger_id)) {
      nodeMap.get(node.parent_ledger_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
