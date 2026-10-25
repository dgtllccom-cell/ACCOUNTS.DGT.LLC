import { NextRequest, NextResponse } from "next/server";
import { getCurrentErpSession } from "@/lib/auth/session";
import { canAccessCityBranch } from "@/lib/permissions/middleware";
import { expensesDenied } from "@/lib/permissions/expenses-access";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { listCountryTaxOptions, resolveBranchExpenseContext } from "@/lib/finance/expense-branch-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/expenses/branch-context?branchId=<city branch id>
 *
 * What an expense bill needs to know about the branch it is entered for: the BASE currency read from the branch / country
 * configuration (nothing is assumed), and the tax codes configured for that branch's country. The form uses this for the
 * base-currency label, the conversion and the tax-code list; the save endpoint re-reads the same values on the server.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (expensesDenied(session, "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const branchId = req.nextUrl.searchParams.get("branchId") || "";
    if (!/^[0-9a-f-]{36}$/i.test(branchId)) return NextResponse.json({ error: "A valid branchId is required." }, { status: 400 });
    if (!canAccessCityBranch(session, branchId)) return NextResponse.json({ error: "This branch is outside your assigned scope." }, { status: 403 });

    const data = await withLocalPg(async (sql) => {
      const ctx = await resolveBranchExpenseContext(sql, branchId);
      const taxOptions = await listCountryTaxOptions(sql, ctx);
      return { ...ctx, taxOptions };
    });
    if (!data) return NextResponse.json({ error: "A direct database connection is required." }, { status: 503 });
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    if (err instanceof ApiClientError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status ?? 400 });
    return NextResponse.json({ error: err?.message || "Failed to load the branch context." }, { status: 500 });
  }
}
