import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope } from "@/lib/permissions/middleware";
import { auditApiAction } from "@/lib/api/audit";
import { withLocalPg } from "@/lib/db/local-postgres";
import { assertBillExpenseModuleAllowed } from "@/lib/permissions/bill-expense-domain";
import { calculateExpenseLine, ExpenseCalcError, type TaxMode } from "@/lib/finance/expense-line-calculator";
import { requireConfiguredTax, resolveBillExpenseContext } from "@/lib/finance/expense-branch-context";

export const dynamic = "force-dynamic";

const EXPENSE_TYPES = ["shipping", "loading", "clearing", "transport", "customs", "handling", "storage", "insurance", "other"] as const;

const lineSchema = z.object({
  expenseType: z.enum(EXPENSE_TYPES).default("other"),
  details: z.string().trim().max(500).optional().nullable(),
  currency: z.string().trim().min(2).max(10),
  amount: z.number().nonnegative(),
  /** base-currency units per ONE unit of the line currency; required when the line currency is not the base currency */
  exchangeRate: z.number().positive().optional(),
  taxMode: z.enum(["exclusive", "inclusive", "exempt"]).optional(),
  taxPct: z.number().min(0).max(100).default(0),
  taxCode: z.string().trim().max(120).optional().nullable()
});

const patchSchema = lineSchema.partial().extend({ lineId: z.string().uuid() });
const deleteSchema = z.object({ lineId: z.string().uuid() });

/** Loads the parent register row and enforces country/branch scope + eligibility. */
async function loadParentInScope(sql: any, id: string, scope: ReturnType<typeof resolveReportScope>, session: Parameters<typeof assertBillExpenseModuleAllowed>[0]) {
  const [be] = await sql`
    select id, source_module, country_id, city_branch_id, eligibility, currency
    from public.bill_expenses where id = ${id}::uuid and deleted_at is null limit 1`;
  if (!be) throw new ApiClientError("Bill expense not found", { status: 404, code: "NOT_FOUND" });
  assertBillExpenseModuleAllowed(session, be.source_module);
  if (scope.level === "country" && scope.countryId && be.country_id !== scope.countryId) {
    throw new ApiClientError("This bill is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });
  }
  if (scope.level === "branch" && scope.branchId && be.city_branch_id !== scope.branchId) {
    throw new ApiClientError("This bill is outside your authorized scope.", { status: 403, code: "FORBIDDEN" });
  }
  if (be.eligibility !== "active") {
    throw new ApiClientError("The source bill is not currently active for expenses.", { status: 409, code: "SOURCE_WITHDRAWN" });
  }
  return be;
}

type LineInput = { currency: string; amount: number; exchangeRate?: number | null; taxMode?: TaxMode; taxPct: number; taxCode?: string | null };

/**
 * ONE calculation for an expense line, identical to the stand-alone expense bills: original → converted into the BASE currency of the
 * bill's branch / country (read from configuration) → tax (exclusive / inclusive / exempt, code and rate from that country's tax list)
 * → grand amount. The stored figures are what the ledger later posts at exchange rate 1, so nothing is ever converted twice.
 */
async function computeLine(sql: any, be: { city_branch_id?: string | null; country_id?: string | null }, input: LineInput) {
  const ctx = await resolveBillExpenseContext(sql, be);
  const currency = input.currency.trim().toUpperCase();
  const pct = Number(input.taxPct) || 0;
  const taxMode: TaxMode = input.taxMode === "inclusive" || input.taxMode === "exclusive" ? input.taxMode : pct > 0 && input.taxMode !== "exempt" ? "exclusive" : "exempt";
  const effectiveMode: TaxMode = taxMode !== "exempt" && pct > 0 ? taxMode : "exempt";
  const taxCode = effectiveMode === "exempt" ? null : (input.taxCode ?? "").trim() || null;
  if (effectiveMode !== "exempt") {
    if (!taxCode) throw new ApiClientError("Choose the tax code that applies to this expense, or mark it tax-exempt.", { status: 422, code: "TAX_CODE_REQUIRED" });
    await requireConfiguredTax(sql, ctx, taxCode, pct);
  }
  try {
    const r = calculateExpenseLine({
      amount: input.amount,
      currency,
      baseCurrency: ctx.baseCurrency,
      operation: "*",
      exchangeRate: input.exchangeRate ?? null,
      taxMode: effectiveMode,
      taxPct: effectiveMode === "exempt" ? 0 : pct
    });
    return {
      baseCurrency: ctx.baseCurrency,
      currency: r.currency,
      amount: r.originalAmount,
      // a same-currency line is stored at rate 1 (this register has always treated 1 as "no conversion")
      exchange_rate: r.currency === r.baseCurrency ? 1 : r.exchangeRate,
      local_amount: r.convertedAmount,
      tax_mode: r.taxMode,
      tax_code: taxCode,
      tax_pct: r.taxPct,
      tax_amount: r.taxAmount,
      tax_base: r.taxBase,
      grand_amount: r.grandAmount
    };
  } catch (e) {
    if (e instanceof ExpenseCalcError) throw new ApiClientError(e.message, { status: 422, code: e.code });
    throw e;
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const { id } = await context.params;
    const body = lineSchema.parse(await request.json());
    const scope = resolveReportScope(session);

    const created = await withLocalPg(async (sql) => {
      const be = await loadParentInScope(sql, id, scope, session);
      const amounts = await computeLine(sql, be, body);
      const [{ next_serial }] = await sql`
        select coalesce(max(row_serial), 0) + 1 as next_serial
        from public.bill_expense_lines where bill_expense_id = ${id}::uuid and deleted_at is null`;
      const [row] = await sql`
        insert into public.bill_expense_lines (
          bill_expense_id, row_serial, expense_type, details, currency, amount,
          exchange_rate, local_amount, tax_mode, tax_code, tax_pct, tax_amount, tax_base, grand_amount, created_by
        ) values (
          ${id}::uuid, ${next_serial}, ${body.expenseType}, ${body.details ?? null},
          ${amounts.currency}, ${amounts.amount}, ${amounts.exchange_rate},
          ${amounts.local_amount}, ${amounts.tax_mode}, ${amounts.tax_code}, ${amounts.tax_pct}, ${amounts.tax_amount}, ${amounts.tax_base}, ${amounts.grand_amount},
          ${session.userId}
        ) returning id, row_serial, grand_amount
      `;
      return { id: row.id as string, row_serial: row.row_serial as number, grand_amount: row.grand_amount, baseCurrency: amounts.baseCurrency, localAmount: amounts.local_amount, taxAmount: amounts.tax_amount };
    });

    if (!created) throw new ApiClientError("Bill-expenses is only available with a direct database connection.", { status: 503 });

    await auditApiAction(request, {
      action: "bill_expense.line.add",
      entityTable: "bill_expense_lines",
      entityId: created.id,
      after: { billExpenseId: id, ...body }
    });

    return apiCreated({ id: created.id, rowSerial: created.row_serial, grandAmount: Number(created.grand_amount), localAmount: created.localAmount, taxAmount: created.taxAmount, baseCurrency: created.baseCurrency });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const scope = resolveReportScope(session);

    const ok = await withLocalPg(async (sql) => {
      const be = await loadParentInScope(sql, id, scope, session);
      const [existing] = await sql`
        select id, currency, amount, exchange_rate, tax_pct, tax_mode, tax_code, posting_status
        from public.bill_expense_lines
        where id = ${body.lineId}::uuid and bill_expense_id = ${id}::uuid and deleted_at is null limit 1`;
      if (!existing) throw new ApiClientError("Expense line not found", { status: 404, code: "NOT_FOUND" });
      if (existing.posting_status === "posted") {
        throw new ApiClientError("A posted expense line cannot be edited. Reverse the posting first.", { status: 409, code: "ALREADY_POSTED" });
      }
      const merged: LineInput = {
        currency: body.currency ?? existing.currency,
        amount: body.amount ?? Number(existing.amount),
        exchangeRate: body.exchangeRate ?? Number(existing.exchange_rate),
        // a new tax % without an explicit treatment derives the treatment from the %, it does not inherit the old one
        taxMode: body.taxMode ?? (body.taxPct !== undefined ? undefined : (existing.tax_mode as TaxMode)),
        taxPct: body.taxPct ?? Number(existing.tax_pct),
        taxCode: body.taxCode !== undefined ? body.taxCode : existing.tax_code
      };
      const amounts = await computeLine(sql, be, merged);
      await sql`
        update public.bill_expense_lines set
          expense_type  = ${body.expenseType ?? sql`expense_type`},
          details       = ${body.details !== undefined ? body.details : sql`details`},
          currency      = ${amounts.currency},
          amount        = ${amounts.amount},
          exchange_rate = ${amounts.exchange_rate},
          local_amount  = ${amounts.local_amount},
          tax_mode      = ${amounts.tax_mode},
          tax_code      = ${amounts.tax_code},
          tax_pct       = ${amounts.tax_pct},
          tax_amount    = ${amounts.tax_amount},
          tax_base      = ${amounts.tax_base},
          grand_amount  = ${amounts.grand_amount}
        where id = ${body.lineId}::uuid
      `;
      return true;
    });

    if (!ok) throw new ApiClientError("Bill-expenses is only available with a direct database connection.", { status: 503 });
    await auditApiAction(request, { action: "bill_expense.line.update", entityTable: "bill_expense_lines", entityId: body.lineId, after: body });
    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const { id } = await context.params;
    const body = deleteSchema.parse(await request.json());
    const scope = resolveReportScope(session);

    const ok = await withLocalPg(async (sql) => {
      await loadParentInScope(sql, id, scope, session);
      const [existing] = await sql`
        select posting_status from public.bill_expense_lines
        where id = ${body.lineId}::uuid and bill_expense_id = ${id}::uuid and deleted_at is null limit 1`;
      if (!existing) throw new ApiClientError("Expense line not found", { status: 404, code: "NOT_FOUND" });
      if (existing.posting_status === "posted") {
        throw new ApiClientError("A posted expense line cannot be deleted. Reverse the posting first.", { status: 409, code: "ALREADY_POSTED" });
      }
      await sql`update public.bill_expense_lines set deleted_at = now() where id = ${body.lineId}::uuid`;
      return true;
    });

    if (!ok) throw new ApiClientError("Bill-expenses is only available with a direct database connection.", { status: 503 });
    await auditApiAction(request, { action: "bill_expense.line.delete", entityTable: "bill_expense_lines", entityId: body.lineId });
    return apiOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
