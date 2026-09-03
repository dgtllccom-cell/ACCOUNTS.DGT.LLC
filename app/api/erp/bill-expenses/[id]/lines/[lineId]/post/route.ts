import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope } from "@/lib/permissions/middleware";
import { auditApiAction } from "@/lib/api/audit";
import { withLocalPg } from "@/lib/db/local-postgres";
import { postRoznamchaWithErpSession } from "@/app/api/erp/roznamcha/posting";
import {
  acquireIdempotencyLock,
  commitIdempotencySuccess,
  releaseIdempotencyLock,
  buildReplayedResponse
} from "@/lib/api/idempotency";

export const dynamic = "force-dynamic";

/**
 * POST /api/erp/bill-expenses/[id]/lines/[lineId]/post
 *
 * Books ONE expense line into the ERP accounts through the SAME engine the Daily-Payment
 * expense transfer uses (`postRoznamchaWithErpSession` → Roznamcha → Journal → Ledger).
 * No new DR/CR mechanism. A balanced 2-line entry:
 *   DR  expense account   (grand_amount, functional currency, rate 1)
 *   CR  counter account   (grand_amount, functional currency, rate 1)
 * `grand_amount` is already the branch-functional-currency amount (local_amount + tax)
 * computed by the line editor, so we post it at exchangeRate 1 — identical rule to
 * `/api/erp/expenses/transfer`.
 *
 * Idempotency-locked so a double click never double-posts. A posted line is locked
 * (edit/delete already 409 in the line editor); un-post with `…/void`.
 */
const bodySchema = z.object({
  expenseAccountId: z.string().uuid(),
  counterAccountId: z.string().uuid()
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; lineId: string }> }) {
  let idemKey = "";
  let tenantHash = "";
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "roznamcha", action: "post" });
    const { id, lineId } = await context.params;
    const body = bodySchema.parse(await request.json());
    const scope = resolveReportScope(session);

    if (body.expenseAccountId === body.counterAccountId) {
      throw new ApiClientError("The expense account and the counter account must be different.", { status: 400, code: "SAME_ACCOUNT" });
    }

    const prepared = await withLocalPg(async (sql) => {
      const [be] = await sql`
        select be.id, be.source_module, be.source_id, be.bill_no, be.manual_bill_no,
               be.country_id, be.country_branch_id, be.city_branch_id, be.eligibility,
               c.currency_code as country_currency, cib.local_currency as branch_currency
        from public.bill_expenses be
        left join public.countries c on c.id = be.country_id
        left join public.city_branches cib on cib.id = be.city_branch_id
        where be.id = ${id}::uuid and be.deleted_at is null limit 1`;
      if (!be) throw new ApiClientError("Bill expense not found", { status: 404, code: "NOT_FOUND" });

      // scope enforcement — never trust the id alone
      if (scope.level === "country" && scope.countryId && be.country_id !== scope.countryId) {
        throw new ApiClientError("This bill is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });
      }
      if (scope.level === "branch" && scope.branchId && be.city_branch_id !== scope.branchId) {
        throw new ApiClientError("This bill is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });
      }
      if (be.eligibility !== "active") {
        throw new ApiClientError("The source bill is not currently active for expenses.", { status: 409, code: "SOURCE_WITHDRAWN" });
      }

      const [line] = await sql`
        select id, row_serial, expense_type, details, currency, amount, exchange_rate,
               local_amount, tax_amount, grand_amount, posting_status
        from public.bill_expense_lines
        where id = ${lineId}::uuid and bill_expense_id = ${id}::uuid and deleted_at is null limit 1`;
      if (!line) throw new ApiClientError("Expense line not found", { status: 404, code: "NOT_FOUND" });
      if (line.posting_status === "posted") {
        throw new ApiClientError("This expense line is already posted. Void the posting to change it.", { status: 409, code: "ALREADY_POSTED" });
      }
      if (Number(line.grand_amount) <= 0) {
        throw new ApiClientError("A zero-amount line cannot be posted.", { status: 400, code: "ZERO_AMOUNT" });
      }

      // both accounts must be live ledgers inside this bill's scope
      const acctRows = await sql`
        select id, name, code, currency, scope, country_id, country_branch_id, city_branch_id, is_active
        from public.ledgers
        where id in (${body.expenseAccountId}::uuid, ${body.counterAccountId}::uuid) and deleted_at is null`;
      if (acctRows.length !== 2) throw new ApiClientError("One or both accounts were not found.", { status: 404, code: "ACCOUNT_NOT_FOUND" });
      for (const a of acctRows) {
        if (a.is_active === false) throw new ApiClientError(`Account ${a.code ?? a.name} is inactive.`, { status: 409, code: "ACCOUNT_INACTIVE" });
        const inScope =
          (be.city_branch_id && a.city_branch_id === be.city_branch_id) ||
          (be.country_branch_id && a.country_branch_id === be.country_branch_id) ||
          (be.country_id && a.country_id === be.country_id) ||
          (!a.country_id && !a.country_branch_id && !a.city_branch_id); // enterprise-wide ledger
        if (!inScope) {
          throw new ApiClientError(`Account ${a.code ?? a.name} belongs to a different country/branch than this bill.`, { status: 403, code: "ACCOUNT_OUT_OF_SCOPE" });
        }
      }

      const functionalCurrency = String(be.branch_currency || be.country_currency || "USD").toUpperCase().slice(0, 3) || "USD";
      const amount = Number(line.grand_amount);
      // The roznamcha posting `type` must be compatible with the selected ledgers' scope
      // (isLedgerScopeCompatible in roznamcha/posting.ts). Derive it from the accounts,
      // not the bill: a super_admin ledger needs type 'super_admin', a country ledger
      // needs 'country' or wider, a branch ledger needs 'branch'.
      const scopes = new Set(acctRows.map((a) => String(a.scope || "")));
      const roznamchaType: "branch" | "country" | "super_admin" =
        scopes.has("super_admin") ? "super_admin"
        : scopes.has("country") ? "country"
        : "branch";

      return {
        be,
        line,
        functionalCurrency,
        amount,
        roznamchaType,
        billRef: be.bill_no || be.manual_bill_no || be.id.slice(0, 8)
      };
    });

    if (!prepared) throw new ApiClientError("Bill-expenses posting needs a direct database connection.", { status: 503 });

    // Idempotency — one lock per (line, accounts) so a double click is a no-op replay.
    const lock = await acquireIdempotencyLock({
      req: request,
      scopeModule: "BILL_EXPENSE_POST",
      userId: session.userId,
      countryId: prepared.be.country_id,
      cityBranchId: prepared.be.city_branch_id,
      businessReference: `${lineId}:${body.expenseAccountId}:${body.counterAccountId}`,
      payload: body
    });
    if (lock.isReplayed) return buildReplayedResponse(lock.responseCode || 200, lock.responseBody);
    if (!lock.acquired) {
      throw new ApiClientError("This expense line is being posted right now. Please wait.", { status: 409, code: "IN_PROGRESS" });
    }
    idemKey = lock.idempotencyKey;
    tenantHash = lock.tenantHash;

    const entryDate = new Date().toISOString().slice(0, 10);
    // A short base-36 time suffix keeps journal/voucher numbers unique across a
    // failed-then-retried post and across a void-then-re-post of the same line
    // (the reversed entry keeps its original number).
    const uniq = Date.now().toString(36).toUpperCase().slice(-5);
    const journalNo = `BEX-${prepared.billRef}-${prepared.line.row_serial}-${uniq}`.slice(0, 118);
    const voucherNo = `BEXV-${prepared.billRef}-${prepared.line.row_serial}-${uniq}`.slice(0, 118);
    const narration =
      `Bill Expense (${prepared.line.expense_type}) on ${prepared.billRef}` +
      (prepared.line.details ? ` — ${prepared.line.details}` : "");

    const roznamchaBody = {
      mode: "post" as const,
      type: prepared.roznamchaType,
      countryId: prepared.be.country_id ?? undefined,
      countryBranchId:
        prepared.roznamchaType === "super_admin" ? undefined : (prepared.be.country_branch_id ?? undefined),
      cityBranchId:
        prepared.roznamchaType === "branch" ? (prepared.be.city_branch_id ?? undefined) : undefined,
      entryDate,
      journalNo,
      voucherNo,
      narration,
      referenceNo: prepared.billRef,
      roznamchaCategory: "business" as const,
      sourceModule: "bill_expenses",
      sourceTransactionType: prepared.be.source_module,
      sourceTransactionId: prepared.be.source_id ?? undefined,
      sourceReferenceNo: prepared.billRef,
      lines: [
        {
          ledgerId: body.expenseAccountId,
          debit: prepared.amount,
          credit: 0,
          currency: prepared.functionalCurrency,
          exchangeRate: 1,
          description: `Expense: ${prepared.line.expense_type}`,
          paymentEntryType: "debit" as const
        },
        {
          ledgerId: body.counterAccountId,
          debit: 0,
          credit: prepared.amount,
          currency: prepared.functionalCurrency,
          exchangeRate: 1,
          description: `Expense settlement: ${prepared.line.expense_type}`,
          paymentEntryType: "credit" as const
        }
      ]
    };

    const { entryId } = await postRoznamchaWithErpSession({
      sessionUserId: session.userId,
      body: roznamchaBody as never
    });

    await withLocalPg(async (sql) => {
      await sql`
        update public.bill_expense_lines set
          posting_status     = 'posted',
          roznamcha_entry_id = ${entryId}::uuid,
          expense_account_id = ${body.expenseAccountId}::uuid,
          counter_account_id = ${body.counterAccountId}::uuid,
          posted_at          = now()
        where id = ${lineId}::uuid`;
    });

    await auditApiAction(request, {
      action: "bill_expense.line.post",
      entityTable: "bill_expense_lines",
      entityId: lineId,
      after: { billExpenseId: id, entryId, ...body, amount: prepared.amount, currency: prepared.functionalCurrency }
    });

    const responseBody = { ok: true, entryId, amount: prepared.amount, currency: prepared.functionalCurrency };
    await commitIdempotencySuccess(idemKey, tenantHash, 200, responseBody);
    return apiOk(responseBody);
  } catch (error) {
    if (idemKey) await releaseIdempotencyLock(idemKey, tenantHash).catch(() => {});
    return handleApiError(error);
  }
}
