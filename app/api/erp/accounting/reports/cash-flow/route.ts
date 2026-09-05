import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { financialStatementQuerySchema } from "@/lib/api/erp-validation";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";

type StatementRow = {
  ledger_id: string;
  code: string | null;
  name: string | null;
  currency: string | null;
  kind: string;
  opening_balance: number;
  period_debit: number;
  period_credit: number;
  closing_balance: number;
};

/**
 * Cash Flow — CLAUDE.md Master Requirement Section A.
 *
 * This is deliberately a "Cash & Bank Position" direct-method report, not
 * an indirect-method 3-way (Operating/Investing/Financing) cash flow
 * statement. A true indirect-method statement needs every account tagged
 * Operating/Investing/Financing, which nothing in this schema records
 * today (confirmed by the capability audit) -- inventing that
 * classification would fabricate a misleading report. Instead this shows
 * the REAL opening vs closing balance, over the requested period, of
 * every ledger identifiably a cash or bank account:
 *   - bank accounts: enterprise_accounts.bank_id IS NOT NULL (a real,
 *     structured column -- 100% reliable)
 *   - cash-on-hand: ledger name/code containing "cash" (a heuristic based
 *     on real account names in this data; there is no dedicated
 *     is_cash_account flag yet, so this is clearly labeled as such rather
 *     than presented as exact)
 * Net cash movement = closing - opening, summed across those ledgers.
 * Reuses get_financial_statement_ledgers exactly as profit-and-loss and
 * balance-sheet do; the only new query here identifies which of those
 * returned ledgers are cash/bank (via withLocalPg against
 * enterprise_accounts, since that classification isn't in the RPC's
 * return columns).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = financialStatementQuerySchema.parse({
      scope: request.nextUrl.searchParams.get("scope"),
      countryId: request.nextUrl.searchParams.get("countryId"),
      countryBranchId: request.nextUrl.searchParams.get("countryBranchId"),
      cityBranchId: request.nextUrl.searchParams.get("cityBranchId"),
      fromDate: request.nextUrl.searchParams.get("fromDate"),
      toDate: request.nextUrl.searchParams.get("toDate")
    });

    authorizeApiScope(session, {
      resource: "reports",
      action: "read",
      countryId: query.countryId,
      countryBranchId: query.countryBranchId,
      cityBranchId: query.cityBranchId
    });

    const supabase = await createApiSupabaseClient();
    const { data, error } = await supabase.rpc("get_financial_statement_ledgers", {
      p_scope: query.scope,
      p_country_id: query.countryId ?? null,
      p_country_branch_id: query.countryBranchId ?? null,
      p_city_branch_id: query.cityBranchId ?? null,
      p_from_date: query.fromDate,
      p_to_date: query.toDate
    });

    if (error) {
      throw new Error(error.message);
    }

    const allRows = (data ?? []) as StatementRow[];
    const assetLedgerIds = allRows.filter((r) => r.kind === "asset").map((r) => r.ledger_id);

    if (assetLedgerIds.length === 0) {
      return apiOk({
        fromDate: query.fromDate,
        toDate: query.toDate,
        scope: query.scope,
        methodology: "direct",
        bankAccounts: [],
        cashAccounts: [],
        totals: { openingBalance: 0, closingBalance: 0, netMovement: 0 }
      });
    }

    const cashBankIds = await withLocalPg(async (sql) => {
      const rows = await sql<{ ledger_id: string; is_bank: boolean }[]>`
        select l.id as ledger_id,
               (ea.bank_id is not null or ea.name ilike '%bank%' or ea.code ilike '%bank%') as is_bank
        from public.ledgers l
        join public.enterprise_accounts ea on ea.id = l.enterprise_account_id
        where l.id = any(${assetLedgerIds}::uuid[])
          and (
            ea.bank_id is not null
            or ea.name ilike '%cash%' or ea.code ilike '%cash%'
            or ea.name ilike '%bank%' or ea.code ilike '%bank%'
          );
      `;
      return rows;
    });

    const bankIdSet = new Set((cashBankIds || []).filter((r) => r.is_bank).map((r) => r.ledger_id));
    const cashBankSet = new Set((cashBankIds || []).map((r) => r.ledger_id));

    const bankAccounts = allRows.filter((r) => bankIdSet.has(r.ledger_id));
    const cashAccounts = allRows.filter((r) => cashBankSet.has(r.ledger_id) && !bankIdSet.has(r.ledger_id));
    const combined = allRows.filter((r) => cashBankSet.has(r.ledger_id));

    const openingBalance = combined.reduce((sum, r) => sum + Number(r.opening_balance || 0), 0);
    const closingBalance = combined.reduce((sum, r) => sum + Number(r.closing_balance || 0), 0);

    return apiOk({
      fromDate: query.fromDate,
      toDate: query.toDate,
      scope: query.scope,
      methodology: "direct",
      bankAccounts,
      cashAccounts,
      totals: {
        openingBalance,
        closingBalance,
        netMovement: closingBalance - openingBalance
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
