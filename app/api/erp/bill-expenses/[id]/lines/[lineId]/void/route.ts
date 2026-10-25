import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope } from "@/lib/permissions/middleware";
import { auditApiAction } from "@/lib/api/audit";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withKeyedLock } from "@/lib/db/keyed-lock";
import { assertBillExpenseModuleAllowed } from "@/lib/permissions/bill-expense-domain";

export const dynamic = "force-dynamic";

/**
 * POST /api/erp/bill-expenses/[id]/lines/[lineId]/void
 *
 * Reverses a posted expense line through the ERP's existing controlled reversal
 * (`reverse_roznamcha_entry` RPC — a balanced contra entry, never deletes journal
 * rows). Sets the line back to `unposted` so it can be edited/re-posted or deleted.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string; lineId: string }> }) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "roznamcha", action: "post" });
    const { id, lineId } = await context.params;
    const scope = resolveReportScope(session);

    // Same per-line lock as posting: a void and a post (or two voids) of one line can never interleave.
    return await withKeyedLock(`bill-expense-line:${lineId}`, async () => {
    const target = await withLocalPg(async (sql) => {
      const [be] = await sql`
        select id, source_module, country_id, city_branch_id, eligibility
        from public.bill_expenses where id = ${id}::uuid and deleted_at is null limit 1`;
      if (!be) throw new ApiClientError("Bill expense not found", { status: 404, code: "NOT_FOUND" });
      assertBillExpenseModuleAllowed(session, be.source_module);
      if (scope.level === "country" && scope.countryId && be.country_id !== scope.countryId) {
        throw new ApiClientError("This bill is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });
      }
      if (scope.level === "branch" && scope.branchId && be.city_branch_id !== scope.branchId) {
        throw new ApiClientError("This bill is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });
      }

      const [line] = await sql`
        select id, row_serial, roznamcha_entry_id, posting_status
        from public.bill_expense_lines
        where id = ${lineId}::uuid and bill_expense_id = ${id}::uuid and deleted_at is null limit 1`;
      if (!line) throw new ApiClientError("Expense line not found", { status: 404, code: "NOT_FOUND" });
      if (line.posting_status !== "posted" || !line.roznamcha_entry_id) {
        throw new ApiClientError("This expense line is not posted.", { status: 409, code: "NOT_POSTED" });
      }
      const [claim] = await sql`
        select id, status from public.shipping_expense_transfers
        where source_table = 'bill_expense_lines' and source_id = ${lineId}::uuid and deleted_at is null
          and status in ('pending', 'accepted') limit 1`;
      if (claim) {
        throw new ApiClientError(`This expense line has an inter-branch claim (${claim.status}). Reject or cancel the claim before voiding the posting.`, { status: 409, code: "HAS_CLAIM" });
      }
      return { entryId: line.roznamcha_entry_id as string };
    });

    if (!target) throw new ApiClientError("Bill-expenses void needs a direct database connection.", { status: 503 });

    // Controlled reversal — same RPC the cash-entry page uses.
    const admin = createSupabaseAdminClient() as any;
    if (session.userId) {
      try {
        await admin.rpc("set_config", {
          setting: "request.jwt.claims",
          value: JSON.stringify({ sub: session.userId, role: "authenticated" }),
          is_local: true
        });
      } catch { /* best effort */ }
    }
    const { data: reversalId, error } = await admin.rpc("reverse_roznamcha_entry", {
      p_original_entry_id: target.entryId,
      p_reason: "Bill-expense line posting voided",
      p_approval_request_id: null
    });
    if (error) throw new ApiClientError(error.message || "Reversal failed", { status: 500, code: "REVERSAL_FAILED" });

    await withLocalPg(async (sql) => {
      await sql`
        update public.bill_expense_lines set
          posting_status     = 'unposted',
          roznamcha_entry_id = null,
          posted_at          = null
        where id = ${lineId}::uuid`;
    });

    await auditApiAction(request, {
      action: "bill_expense.line.void",
      entityTable: "bill_expense_lines",
      entityId: lineId,
      after: { billExpenseId: id, reversedEntryId: target.entryId, reversalId }
    });

    return apiOk({ ok: true, reversalId });
    }, { busyMessage: "This expense line is being posted or voided right now. Please wait a moment and refresh before trying again." });
  } catch (error) {
    return handleApiError(error);
  }
}
