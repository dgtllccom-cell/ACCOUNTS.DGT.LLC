import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Outstanding / Recovery ledger report.
 * Reads the ledger_outstanding_v view (active ledgers with non-zero balance
 * + last movement date). Scoped to the caller's country/branch (defense in
 * depth, same pattern as the ledger balances report).
 *
 *   GET /api/erp/accounting/reports/ledger/outstanding
 *        ?countryId=<uuid>      (optional filter; super admin cross-country)
 *        &overdueDays=<n>       (optional; only rows aged >= n days)
 *        &side=all|debit|credit (optional; receivable=debit, payable=credit)
 */
const querySchema = z.object({
  countryId: z.string().uuid().optional(),
  overdueDays: z.coerce.number().int().min(0).optional(),
  side: z.enum(["all", "debit", "credit"]).optional().default("all"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "reports", action: "read" });

    const q = querySchema.parse({
      countryId: request.nextUrl.searchParams.get("countryId") ?? undefined,
      overdueDays: request.nextUrl.searchParams.get("overdueDays") ?? undefined,
      side: request.nextUrl.searchParams.get("side") ?? undefined,
    });

    const admin = createSupabaseAdminClient() as any;
    let view = admin
      .from("ledger_outstanding_v")
      .select(
        "id, scope, country_id, country_branch_id, city_branch_id, account_id, code, name, currency, opening_balance, current_balance, debit_total, credit_total, last_movement_date, days_since_movement"
      );

    // Scope restriction for non-super-admins.
    if (!session.isSuperAdmin) {
      const conditions: string[] = [];
      if (session.cityBranchIds?.length) conditions.push(`city_branch_id.in.(${session.cityBranchIds.join(",")})`);
      if (session.countryBranchIds?.length) conditions.push(`country_branch_id.in.(${session.countryBranchIds.join(",")})`);
      if (session.countryIds?.length) conditions.push(`country_id.in.(${session.countryIds.join(",")})`);
      view = conditions.length
        ? view.or(conditions.join(","))
        : view.eq("id", "00000000-0000-0000-0000-000000000000");
    } else if (q.countryId) {
      view = view.eq("country_id", q.countryId);
    }

    const { data, error } = await view.order("days_since_movement", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    let rows = (data ?? []).map((r: any) => {
      const bal = Number(r.current_balance ?? 0);
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        currency: r.currency,
        countryId: r.country_id,
        scope: r.scope,
        openingBalance: Number(r.opening_balance ?? 0),
        outstanding: bal,
        side: bal > 0 ? "debit" : bal < 0 ? "credit" : "zero", // debit balance = receivable
        debitTotal: Number(r.debit_total ?? 0),
        creditTotal: Number(r.credit_total ?? 0),
        lastMovementDate: r.last_movement_date,
        daysOutstanding: r.days_since_movement,
      };
    });

    if (q.side === "debit") rows = rows.filter((x: any) => x.outstanding > 0);
    else if (q.side === "credit") rows = rows.filter((x: any) => x.outstanding < 0);

    if (typeof q.overdueDays === "number") {
      rows = rows.filter((x: any) => (x.daysOutstanding ?? 0) >= q.overdueDays!);
    }

    const summary = {
      accounts: rows.length,
      totalReceivable: rows.filter((x: any) => x.outstanding > 0).reduce((s: number, x: any) => s + x.outstanding, 0),
      totalPayable: rows.filter((x: any) => x.outstanding < 0).reduce((s: number, x: any) => s + Math.abs(x.outstanding), 0),
      overdue10: rows.filter((x: any) => (x.daysOutstanding ?? 0) > 10).length,
    };

    return apiOk({ rows, summary });
  } catch (error) {
    return handleApiError(error);
  }
}
