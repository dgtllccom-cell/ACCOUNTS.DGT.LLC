import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { enterpriseLedgerCreateSchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);

    authorizeApiScope(session, {
      resource: "ledgers",
      action: "read",
      ...scope
    });

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

    const { data, error } = await query.limit(300);

    if (error) {
      throw new Error(error.message);
    }

    return apiOk({
      ledgers: data ?? [],
      hierarchy: buildLedgerTree((data ?? []) as LedgerNode[])
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

    return apiCreated({
      ledgerId: data as string
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
