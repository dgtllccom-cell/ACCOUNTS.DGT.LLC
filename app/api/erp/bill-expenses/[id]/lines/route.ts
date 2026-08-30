import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiCreated, handleApiError, ApiClientError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { authorize, resolveReportScope } from "@/lib/permissions/middleware";
import { auditApiAction } from "@/lib/api/audit";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

const EXPENSE_TYPES = ["shipping", "loading", "clearing", "transport", "customs", "handling", "storage", "insurance", "other"] as const;

const lineSchema = z.object({
  expenseType: z.enum(EXPENSE_TYPES).default("other"),
  details: z.string().trim().max(500).optional().nullable(),
  currency: z.string().trim().min(2).max(10),
  amount: z.number().nonnegative(),
  exchangeRate: z.number().positive().default(1),
  taxPct: z.number().min(0).max(100).default(0)
});

const patchSchema = lineSchema.partial().extend({ lineId: z.string().uuid() });
const deleteSchema = z.object({ lineId: z.string().uuid() });

/** Loads the parent register row and enforces country/branch scope + eligibility. */
async function loadParentInScope(sql: any, id: string, scope: ReturnType<typeof resolveReportScope>) {
  const [be] = await sql`
    select id, country_id, city_branch_id, eligibility, currency
    from public.bill_expenses where id = ${id}::uuid and deleted_at is null limit 1`;
  if (!be) throw new ApiClientError("Bill expense not found", { status: 404, code: "NOT_FOUND" });
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

function computeAmounts(input: { amount: number; exchangeRate: number; taxPct: number }) {
  const local = +(input.amount * input.exchangeRate).toFixed(4);
  const tax = +(local * (input.taxPct / 100)).toFixed(4);
  const grand = +(local + tax).toFixed(4);
  return { local_amount: local, tax_amount: tax, grand_amount: grand };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    authorize(session, { resource: "reports", action: "read" });
    const { id } = await context.params;
    const body = lineSchema.parse(await request.json());
    const scope = resolveReportScope(session);

    const created = await withLocalPg(async (sql) => {
      await loadParentInScope(sql, id, scope);
      const [{ next_serial }] = await sql`
        select coalesce(max(row_serial), 0) + 1 as next_serial
        from public.bill_expense_lines where bill_expense_id = ${id}::uuid and deleted_at is null`;
      const amounts = computeAmounts(body);
      const [row] = await sql`
        insert into public.bill_expense_lines (
          bill_expense_id, row_serial, expense_type, details, currency, amount,
          exchange_rate, local_amount, tax_pct, tax_amount, grand_amount, created_by
        ) values (
          ${id}::uuid, ${next_serial}, ${body.expenseType}, ${body.details ?? null},
          ${body.currency}, ${body.amount}, ${body.exchangeRate},
          ${amounts.local_amount}, ${body.taxPct}, ${amounts.tax_amount}, ${amounts.grand_amount},
          ${session.userId}
        ) returning id, row_serial, grand_amount
      `;
      return row;
    });

    if (!created) throw new ApiClientError("Bill-expenses is only available with a direct database connection.", { status: 503 });

    await auditApiAction(request, {
      action: "bill_expense.line.add",
      entityTable: "bill_expense_lines",
      entityId: created.id,
      after: { billExpenseId: id, ...body }
    });

    return apiCreated({ id: created.id, rowSerial: created.row_serial, grandAmount: Number(created.grand_amount) });
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
      await loadParentInScope(sql, id, scope);
      const [existing] = await sql`
        select id, currency, amount, exchange_rate, tax_pct, posting_status
        from public.bill_expense_lines
        where id = ${body.lineId}::uuid and bill_expense_id = ${id}::uuid and deleted_at is null limit 1`;
      if (!existing) throw new ApiClientError("Expense line not found", { status: 404, code: "NOT_FOUND" });
      if (existing.posting_status === "posted") {
        throw new ApiClientError("A posted expense line cannot be edited. Reverse the posting first.", { status: 409, code: "ALREADY_POSTED" });
      }
      const merged = {
        amount: body.amount ?? Number(existing.amount),
        exchangeRate: body.exchangeRate ?? Number(existing.exchange_rate),
        taxPct: body.taxPct ?? Number(existing.tax_pct)
      };
      const amounts = computeAmounts(merged);
      await sql`
        update public.bill_expense_lines set
          expense_type  = ${body.expenseType ?? sql`expense_type`},
          details       = ${body.details !== undefined ? body.details : sql`details`},
          currency      = ${body.currency ?? sql`currency`},
          amount        = ${merged.amount},
          exchange_rate = ${merged.exchangeRate},
          tax_pct       = ${merged.taxPct},
          local_amount  = ${amounts.local_amount},
          tax_amount    = ${amounts.tax_amount},
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
      await loadParentInScope(sql, id, scope);
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
