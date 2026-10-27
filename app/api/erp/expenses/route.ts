import { NextResponse } from "next/server";
import { sessionSqlScope } from "@/lib/api/scope-middleware";
import { getCurrentErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canAccessCityBranch } from "@/lib/permissions/middleware";
import { shippingAccountingDenied } from "@/lib/permissions/shipping-explicit-gate";
import { expensesDenied, SHIPPING_ACCOUNTING_BILL_TITLES } from "@/lib/permissions/expenses-access";
import { expenseBillTitleAllowed, effectiveExpenseSection } from "@/lib/permissions/bill-expense-domain";
import { calculateExpenseLine, ExpenseCalcError, sumGrand, type TaxMode } from "@/lib/finance/expense-line-calculator";
import { requireConfiguredTax, resolveBranchExpenseContext } from "@/lib/finance/expense-branch-context";
import { withLocalPg } from "@/lib/db/local-postgres";
import { ApiClientError } from "@/lib/api/response";
import { z, ZodError } from "zod";

const expensesBillLineSchema = z.object({
  rowSerial: z.number(),
  details: z.string().min(1),
  qty: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
  amount: z.number(),
  currency: z.string().min(2).max(10),
  operation: z.string(),
  exchangeRate: z.number().nonnegative(),
  finalAmount: z.number(),
  taxOn: z.boolean(),
  taxPct: z.number().nonnegative(),
  taxAmt: z.number().nonnegative(),
  grandAmount: z.number(),
  taxMode: z.enum(["exclusive", "inclusive", "exempt"]).optional(),
  taxCode: z.string().trim().max(120).nullish()
});

const expensesBillPayloadSchema = z.object({
  header: z.object({
    id: z.string().uuid().optional(),
    billSerial: z.string().min(1),
    branch: z.string().min(1),
    billDate: z.string().date(),
    billMode: z.string(),
    billTitle: z.string(),
    referenceNo: z.string().nullable().optional(),
    debitLedgerId: z.string().uuid().nullable().optional(),
    creditLedgerId: z.string().uuid().nullable().optional()
  }),
  entries: z.array(expensesBillLineSchema).min(1)
});

import { acquireIdempotencyLock, commitIdempotencySuccess, releaseIdempotencyLock, buildReplayedResponse } from "@/lib/api/idempotency";
import { translateMasterRecord } from "@/lib/services/translation-trigger-service";
import { NextRequest } from "next/server";

const close = (submitted: number, calculated: number) => Math.abs(submitted - calculated) <= 0.011 + Math.abs(calculated) * 0.0001;

/**
 * POST /api/erp/expenses — create or edit ONE expense bill (header + rows) atomically.
 *
 * The server is the authority for the numbers: every row is recalculated here with the shared calculator from the row's own
 * original amount, currency, exchange rate and tax treatment, converted into the BASE currency read from the branch / country
 * configuration. Figures submitted by the client must agree with the recalculation (tolerance 0.01) or the bill is refused.
 * A row's tax code must belong to the branch's country and carry that country's configured rate, unless the row is exempt.
 */
export async function POST(req: NextRequest) {
  let idempotencyKey = "";
  let tenantHash = "";
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (expensesDenied(session, "create")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = expensesBillPayloadSchema.parse(body);
    const { header, entries } = parsed;

    if (expensesDenied(session, "create", header.billTitle)) {
      return NextResponse.json({ error: "Forbidden: No permission to create this expense bill type" }, { status: 403 });
    }

    // Business and Shipping Line expenses stay separated: a login only saves bills of its own operational section.
    if (!expenseBillTitleAllowed(session, header.billTitle)) {
      return NextResponse.json({ error: "This bill type belongs to a different operational section than your login (Business vs Shipping Line).", code: "DOMAIN_FORBIDDEN" }, { status: 403 });
    }
    if (SHIPPING_ACCOUNTING_BILL_TITLES.has(header.billTitle)) {
      const denied = shippingAccountingDenied(session);
      if (denied) return denied;
    }
    if (!canAccessCityBranch(session, header.branch)) {
      return NextResponse.json({ error: "This branch is outside your assigned scope." }, { status: 403 });
    }

    const lockRes = await acquireIdempotencyLock({
      req,
      scopeModule: "EXPENSES",
      userId: session.userId,
      countryId: session.countryIds?.[0] ?? null,
      cityBranchId: session.cityBranchIds?.[0] || header.branch,
      businessReference: header.billSerial || header.referenceNo,
      payload: body
    });

    if (lockRes.isReplayed) {
      return buildReplayedResponse(lockRes.responseCode || 200, lockRes.responseBody);
    }

    if (!lockRes.acquired) {
      return NextResponse.json(
        { error: "A request with this idempotency key is currently being processed or duplicate submission detected. Please wait." },
        { status: 409 }
      );
    }

    idempotencyKey = lockRes.idempotencyKey;
    tenantHash = lockRes.tenantHash;

    // ── Rule 1: Country Scope Validation for Expense Ledgers ──
    const adminForScope = createSupabaseAdminClient() as any;
    const { validateLedgerCountryScope } = await import("@/lib/api/country-scope-validator");
    if (header.debitLedgerId) {
      await validateLedgerCountryScope(session, header.debitLedgerId, null, adminForScope);
    }
    if (header.creditLedgerId) {
      await validateLedgerCountryScope(session, header.creditLedgerId, null, adminForScope);
    }

    const saved = await withLocalPg(async (sql) =>
      sql.begin(async (tx: any) => {
        // Base currency + country come from configuration, never from the client.
        const ctx = await resolveBranchExpenseContext(tx, header.branch);

        const calculated = [] as Array<ReturnType<typeof calculateExpenseLine> & { row: (typeof entries)[number]; taxCode: string | null }>;
        for (const row of entries) {
          const taxMode: TaxMode = !row.taxOn ? "exempt" : row.taxMode === "inclusive" ? "inclusive" : "exclusive";
          const taxCode = taxMode === "exempt" ? null : (row.taxCode ?? "").trim() || null;
          if (taxMode !== "exempt" && row.taxPct > 0) {
            if (!taxCode) throw new ApiClientError(`Row ${row.rowSerial}: choose the tax code that applies to this expense.`, { status: 422, code: "TAX_CODE_REQUIRED" });
            await requireConfiguredTax(tx, ctx, taxCode, row.taxPct);
          }
          let result;
          try {
            result = calculateExpenseLine({
              qty: row.qty,
              unitPrice: row.unitPrice,
              amount: row.amount,
              currency: row.currency,
              baseCurrency: ctx.baseCurrency,
              operation: row.operation === "/" ? "/" : "*",
              exchangeRate: row.exchangeRate,
              taxMode,
              taxPct: row.taxPct
            });
          } catch (e) {
            if (e instanceof ExpenseCalcError) throw new ApiClientError(`Row ${row.rowSerial}: ${e.message}`, { status: 422, code: e.code });
            throw e;
          }
          if (!close(row.finalAmount, result.convertedAmount) || !close(row.grandAmount, result.grandAmount) || !close(row.taxAmt, result.taxAmount)) {
            throw new ApiClientError(
              `Row ${row.rowSerial}: the submitted amounts do not match the calculation (converted ${result.convertedAmount}, tax ${result.taxAmount}, total ${result.grandAmount} ${ctx.baseCurrency}). Refresh the row and save again.`,
              { status: 422, code: "AMOUNT_MISMATCH" }
            );
          }
          calculated.push({ ...result, row, taxCode });
        }
        const total = sumGrand(calculated);
        if (!(total.total > 0)) throw new ApiClientError("The bill total must be greater than zero.", { status: 422, code: "ZERO_TOTAL" });

        let billId = header.id;
        let createdNewHeader = false;
        if (billId) {
          const [existing] = await tx`select transferred_to_roznamcha, branch_id from public.expenses_bills where id = ${billId}::uuid and deleted_at is null for update`;
          if (!existing) throw new ApiClientError("Bill not found.", { status: 404, code: "NOT_FOUND" });
          if (existing.transferred_to_roznamcha) throw new ApiClientError("Cannot edit a bill that has already been transferred to Roznamcha.", { status: 409, code: "ALREADY_TRANSFERRED" });
          if (!canAccessCityBranch(session, existing.branch_id)) throw new ApiClientError("This bill belongs to a branch outside your assigned scope.", { status: 403, code: "FORBIDDEN" });
          await tx`
            update public.expenses_bills set
              branch_id = ${header.branch}::uuid, bill_date = ${header.billDate}, bill_mode = ${header.billMode}, bill_title = ${header.billTitle},
              reference_no = ${header.referenceNo || null}, debit_ledger_id = ${header.debitLedgerId || null}, credit_ledger_id = ${header.creditLedgerId || null},
              base_currency = ${ctx.baseCurrency}, updated_at = now()
            where id = ${billId}::uuid`;
          await tx`delete from public.expenses_bill_lines where bill_id = ${billId}::uuid`;
        } else {
          let serialNo = header.billSerial;
          if (serialNo.trim().toUpperCase() === "AUTO") {
            const [s] = await tx`select public.next_entity_serial('global', 'GLOBAL', 'expenses_bills', 'EXP') as serial`;
            if (!s?.serial) throw new Error("Failed to allocate bill serial: empty");
            serialNo = String(s.serial);
          }
          const [h] = await tx`
            insert into public.expenses_bills (serial_no, branch_id, bill_date, bill_mode, bill_title, reference_no, debit_ledger_id, credit_ledger_id, base_currency, created_at, created_by)
            values (${serialNo}, ${header.branch}::uuid, ${header.billDate}, ${header.billMode}, ${header.billTitle}, ${header.referenceNo || null},
                    ${header.debitLedgerId || null}, ${header.creditLedgerId || null}, ${ctx.baseCurrency}, now(), ${session.userId || null})
            returning id`;
          billId = h.id as string;
          createdNewHeader = true;
        }

        for (const c of calculated) {
          await tx`
            insert into public.expenses_bill_lines (
              bill_id, row_serial, details, qty, unit_price, amount, currency, operation, exchange_rate,
              final_amount, tax_on, tax_pct, tax_amt, grand_amount, tax_mode, tax_code, tax_base, created_at
            ) values (
              ${billId}::uuid, ${c.row.rowSerial}, ${c.row.details}, ${c.row.qty}, ${c.row.unitPrice}, ${c.originalAmount}, ${c.currency}, ${c.operation},
              ${c.currency === c.baseCurrency ? 0 : c.exchangeRate}, ${c.convertedAmount}, ${c.taxMode !== "exempt"}, ${c.taxPct}, ${c.taxAmount}, ${c.grandAmount},
              ${c.taxMode}, ${c.taxCode}, ${c.taxBase}, now()
            )`;
        }

        return { billId: billId as string, createdNewHeader, baseCurrency: ctx.baseCurrency, total: total.total, lines: calculated.map((c) => ({ rowSerial: c.row.rowSerial, convertedAmount: c.convertedAmount, taxAmount: c.taxAmount, grandAmount: c.grandAmount })) };
      })
    );
    if (!saved) throw new ApiClientError("Saving an expense bill needs a direct database connection.", { status: 503, code: "NO_DB" });

    if (header.billTitle) void translateMasterRecord("expenses_bills", saved.billId, { bill_title: header.billTitle }, session.preferredLanguage ?? "en", session.userId || null);

    const resPayload = { success: true, billId: saved.billId, baseCurrency: saved.baseCurrency, total: saved.total, lines: saved.lines };
    if (idempotencyKey && tenantHash) {
      await commitIdempotencySuccess(idempotencyKey, tenantHash, 200, resPayload);
    }
    return NextResponse.json(resPayload);
  } catch (err: any) {
    if (idempotencyKey && tenantHash) {
      await releaseIdempotencyLock(idempotencyKey, tenantHash);
    }
    if (err instanceof ApiClientError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status ?? 400 });
    }
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid expense bill: " + err.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") }, { status: 400 });
    }
    console.error("Expenses POST Error:", err);
    return NextResponse.json({ error: err.message || "Failed to save expenses bill" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getCurrentErpSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (expensesDenied(session, "read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 50);
    const category = searchParams.get("category");
    if (category && expensesDenied(session, "read", category)) {
      return NextResponse.json({ error: "Forbidden: No permission for this expense category" }, { status: 403 });
    }
    if (category && SHIPPING_ACCOUNTING_BILL_TITLES.has(category)) {
      const denied = shippingAccountingDenied(session);
      if (denied) return denied;
    }
    // Business-only / Shipping-only logins are pinned to their own section; logins explicitly authorized for both may ask for
    // section=business|shipping (default: all). The country / branch scope below is never widened by this.
    const section = effectiveExpenseSection(session, searchParams.get("section"));
    const shippingTitles = [...SHIPPING_ACCOUNTING_BILL_TITLES];

    // One scope rule: expense bills are keyed by their city branch (branch_id). The session's
    // city-branch list is already expanded downward (country admin → every branch of the
    // country, branch user → own branch), so it expresses exactly the sessionSqlScope rule.
    const sqlScope = sessionSqlScope(session);
    const allowedBranchIds: string[] | null = sqlScope.kind === "all" ? null : sqlScope.kind === "none" ? [] : session.cityBranchIds;
    if (allowedBranchIds && allowedBranchIds.length === 0) return NextResponse.json({ bills: [], section });

    // Try direct PostgreSQL first for resilience and performance
    const viaPg = await withLocalPg(async (sql) => {
      const rows = await sql`
        select
          b.*,
          case when cp.id is not null then jsonb_build_object('full_name', cp.full_name) else null end as profiles,
          case when cb.id is not null then jsonb_build_object(
            'name', cb.name,
            'country_id', cb.country_id,
            'countries', case when c.id is not null then jsonb_build_object('name', c.name, 'iso2', c.iso2, 'currency_code', c.currency_code) else null end
          ) else null end as city_branches,
          coalesce(
            (select jsonb_agg(l order by l.row_serial asc) from public.expenses_bill_lines l where l.bill_id = b.id),
            '[]'::jsonb
          ) as expenses_bill_lines
        from public.expenses_bills b
        left join public.profiles cp on cp.id = b.created_by
        left join public.city_branches cb on cb.id = b.branch_id
        left join public.countries c on c.id = cb.country_id
        where b.deleted_at is null
          and (${category}::text is null or b.bill_title = ${category})
          ${section === "shipping" ? sql`and b.bill_title = any(${shippingTitles})` : section === "business" ? sql`and not (b.bill_title = any(${shippingTitles}))` : sql``}
          and ${allowedBranchIds ? sql`b.branch_id = ANY(${allowedBranchIds}::uuid[])` : sql`true`}
        order by b.created_at desc
        limit ${limit}
      `;
      return rows;
    });

    if (viaPg !== undefined) {
      return NextResponse.json({ bills: viaPg, section });
    }

    const supabase = createSupabaseAdminClient() as any;

    let query = supabase
      .from("expenses_bills")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq("bill_title", category);
    }
    if (allowedBranchIds) {
      query = query.in("branch_id", allowedBranchIds);
    }
    if (section === "shipping") query = query.in("bill_title", shippingTitles);
    if (section === "business") query = query.not("bill_title", "in", `(${shippingTitles.join(",")})`);

    const { data: bills, error: billsError } = await query;

    if (billsError) throw new Error(billsError.message);

    const billIds = (bills || []).map((b: any) => b.id);
    let allLines: any[] = [];
    if (billIds.length > 0) {
      const { data: linesData } = await supabase
        .from("expenses_bill_lines")
        .select("*")
        .in("bill_id", billIds)
        .order("row_serial", { ascending: true });
      allLines = linesData || [];
    }

    const billsWithLines = (bills || []).map((b: any) => ({
      ...b,
      expenses_bill_lines: allLines.filter((l: any) => l.bill_id === b.id)
    }));

    return NextResponse.json({ bills: billsWithLines, section });
  } catch (err: any) {
    console.error("Expenses GET Error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch expenses bills" }, { status: 500 });
  }
}
