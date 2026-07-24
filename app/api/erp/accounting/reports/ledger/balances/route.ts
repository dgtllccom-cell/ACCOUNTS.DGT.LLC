import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  ids: z.string().trim().min(1)
});

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const query = querySchema.parse({ ids: request.nextUrl.searchParams.get("ids") ?? "" });
    const ids = unique(
      query.ids
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0)
    ).slice(0, 50);

    authorizeApiScope(session, { resource: "reports", action: "read" });

    const admin = createSupabaseAdminClient() as any;

    // Restrict ledgers by session scope (defense in depth).
    let ledgersQ = admin.from("ledgers").select("id, country_id, country_branch_id, city_branch_id").in("id", ids).is("deleted_at", null);

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
        ledgersQ = ledgersQ.or(conditions.join(","));
      } else {
        ledgersQ = ledgersQ.eq("id", "00000000-0000-0000-0000-000000000000");
      }
    }

    const { data: ledgers, error: ledgersErr } = await ledgersQ;
    if (ledgersErr) throw new Error(ledgersErr.message);

    const allowedIds = (ledgers ?? []).map((l: any) => l.id);
    if (!allowedIds.length) {
      return apiOk({ balances: {} as Record<string, any> });
    }

    // Fetch latest balance rows; client will use the newest by date for each ledger.
    const { data: balancesRows, error: balErr } = await admin
      .from("ledger_balances")
      .select("ledger_id, balance_date, debit_total, credit_total, closing_balance, updated_at")
      .in("ledger_id", allowedIds)
      .order("balance_date", { ascending: false })
      .limit(500);

    if (balErr) throw new Error(balErr.message);

    const balances: Record<
      string,
      {
        ledgerId: string;
        balanceDate: string;
        debitTotal: number;
        creditTotal: number;
        closingBalance: number;
        currencyCode: string;
        updatedAt: string;
      }
    > = {};

    for (const row of balancesRows ?? []) {
      const id = (row as any).ledger_id as string;
      if (!balances[id]) {
        // ledger_balances doesn't store currency_code; client can show ledger currency.
        balances[id] = {
          ledgerId: id,
          balanceDate: (row as any).balance_date,
          debitTotal: (row as any).debit_total ?? 0,
          creditTotal: (row as any).credit_total ?? 0,
          closingBalance: (row as any).closing_balance ?? 0,
          currencyCode: "",
          updatedAt: (row as any).updated_at
        };
      }
    }

    return apiOk({ balances });
  } catch (error) {
    return handleApiError(error);
  }
}
