/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiCreated, apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { withLocalPg } from "@/lib/db/local-postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);
    const params = request.nextUrl.searchParams;

    authorizeApiScope(session, { resource: "roznamcha", action: "read", ...scope });

    const fromDate = params.get("fromDate")?.trim();
    const toDate = params.get("toDate")?.trim();
    const companyId = params.get("companyId")?.trim();
    const countryId = params.get("countryId")?.trim();
    const countryBranchId = params.get("countryBranchId")?.trim();
    const cityBranchId = params.get("cityBranchId")?.trim();
    const bankName = params.get("bankName")?.trim();
    const bankId = params.get("bankId")?.trim();
    const userId = params.get("userId")?.trim();
    const chequeNo = params.get("chequeNo")?.trim();
    const status = params.get("status")?.trim();
    const tab = params.get("tab")?.trim() || "all";
    const q = params.get("q")?.trim();
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params.get("pageSize")) || 25));
    const sortBy = params.get("sortBy")?.trim() || "entry_date";
    const sortDir = params.get("sortDir")?.trim() === "desc" ? "desc" : "asc";

    const todayIso = new Date().toISOString().slice(0, 10);

    const result = await withLocalPg(async (sql) => {
      let cityIds: string[] = [];
      let countryBranchIds: string[] = [];
      let countryIds: string[] = [];
      if (!session.isSuperAdmin) {
        for (const assignment of session.assignments) {
          if (assignment.cityBranchId) cityIds.push(assignment.cityBranchId);
          else if (assignment.countryBranchId) countryBranchIds.push(assignment.countryBranchId);
          else if (assignment.countryId) countryIds.push(assignment.countryId);
        }
        cityIds = [...new Set(cityIds)];
        countryBranchIds = [...new Set(countryBranchIds)];
        countryIds = [...new Set(countryIds)];
      }

      // Safe string escaping for search
      const safeQ = q ? q.replace(/[%,]/g, "") : null;
      const safeCheque = chequeNo ? chequeNo.replace(/[%,]/g, "") : null;
      const safeBank = bankName && bankName !== "all" ? bankName.replace(/[%,]/g, "") : null;

      // 1. Calculate Opening Balance: Sum of (credits - debits) of cleared transactions BEFORE fromDate
      const openingRows = await sql`
        SELECT COALESCE(SUM(credit - debit), 0) AS opening_balance
        FROM public.bank_cheque_transactions
        WHERE deleted_at IS NULL
          AND (${companyId && companyId !== "all" ? sql`company_id = ${companyId}` : sql`true`})
          AND (${countryId && countryId !== "all" ? sql`country_id = ${countryId}` : sql`true`})
          AND (${countryBranchId && countryBranchId !== "all" ? sql`country_branch_id = ${countryBranchId}` : sql`true`})
          AND (${cityBranchId && cityBranchId !== "all" ? sql`city_branch_id = ${cityBranchId}` : sql`true`})
          AND (${safeBank ? sql`(bank_name ILIKE ${"%" + safeBank + "%"} OR bank_code ILIKE ${"%" + safeBank + "%"})` : sql`true`})
          AND (${fromDate ? sql`entry_date < ${fromDate}` : sql`false`})
          AND (${session.isSuperAdmin
            ? sql`true`
            : sql`(city_branch_id = ANY(${cityIds}) OR country_branch_id = ANY(${countryBranchIds}) OR country_id = ANY(${countryIds}))`})
      `;
      const openingBalance = Number(openingRows[0]?.opening_balance || 0);

      // 2. Fetch all matching transactions in the selected scope & date range
      const allRows = await sql`
        SELECT
          t.id, t.entry_serial_number, t.voucher_no, t.journal_no,
          t.entry_date, t.entry_time,
          t.user_id, t.user_name,
          t.bank_id, t.bank_name, t.bank_code,
          t.cheque_no, t.particulars, t.cheque_date, t.due_date,
          t.debit, t.credit, t.currency, t.status,
          t.cleared_at, t.dishonored_at, t.dishonor_reason, t.presented_at,
          t.notes, t.audit_trail,
          t.company_id, t.country_id, t.country_branch_id, t.city_branch_id,
          CASE WHEN comp.id IS NOT NULL THEN jsonb_build_object('id', comp.id, 'name', comp.name) ELSE NULL END AS company,
          CASE WHEN c.id IS NOT NULL THEN jsonb_build_object('id', c.id, 'name', c.name, 'currency_code', c.currency_code) ELSE NULL END AS country,
          CASE WHEN cb.id IS NOT NULL THEN jsonb_build_object('id', cb.id, 'name', cb.name, 'code', cb.code) ELSE NULL END AS country_branch,
          CASE WHEN cib.id IS NOT NULL THEN jsonb_build_object('id', cib.id, 'name', cib.name, 'code', cib.code) ELSE NULL END AS city_branch,
          CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('id', p.id, 'full_name', p.full_name) ELSE NULL END AS profile
        FROM public.bank_cheque_transactions t
        LEFT JOIN public.companies comp ON comp.id = t.company_id
        LEFT JOIN public.countries c ON c.id = t.country_id
        LEFT JOIN public.country_branches cb ON cb.id = t.country_branch_id
        LEFT JOIN public.city_branches cib ON cib.id = t.city_branch_id
        LEFT JOIN public.profiles p ON p.id = t.user_id
        WHERE t.deleted_at IS NULL
          AND (${companyId && companyId !== "all" ? sql`t.company_id = ${companyId}` : sql`true`})
          AND (${countryId && countryId !== "all" ? sql`t.country_id = ${countryId}` : sql`true`})
          AND (${countryBranchId && countryBranchId !== "all" ? sql`t.country_branch_id = ${countryBranchId}` : sql`true`})
          AND (${cityBranchId && cityBranchId !== "all" ? sql`t.city_branch_id = ${cityBranchId}` : sql`true`})
          AND (${fromDate ? sql`t.entry_date >= ${fromDate}` : sql`true`})
          AND (${toDate ? sql`t.entry_date <= ${toDate}` : sql`true`})
          AND (${userId && userId !== "all" ? sql`t.user_id = ${userId}` : sql`true`})
          AND (${safeBank ? sql`(t.bank_name ILIKE ${"%" + safeBank + "%"} OR t.bank_code ILIKE ${"%" + safeBank + "%"})` : sql`true`})
          AND (${safeCheque ? sql`t.cheque_no ILIKE ${"%" + safeCheque + "%"}` : sql`true`})
          AND (${status && status !== "all" ? sql`t.status = ${status}` : sql`true`})
          AND (${safeQ ? sql`(
                t.entry_serial_number ILIKE ${"%" + safeQ + "%"}
                OR t.cheque_no ILIKE ${"%" + safeQ + "%"}
                OR t.particulars ILIKE ${"%" + safeQ + "%"}
                OR t.bank_name ILIKE ${"%" + safeQ + "%"}
                OR t.user_name ILIKE ${"%" + safeQ + "%"}
              )` : sql`true`})
          AND (${session.isSuperAdmin
            ? sql`true`
            : sql`(t.city_branch_id = ANY(${cityIds}) OR t.country_branch_id = ANY(${countryBranchIds}) OR t.country_id = ANY(${countryIds}))`})
        ORDER BY t.entry_date ASC, t.entry_time ASC, t.entry_serial_number ASC
      `;

      // 3. Compute running balances chronologically and calculate summary counters
      let running = openingBalance;
      let totalDebit = 0;
      let totalCredit = 0;
      let clearedCount = 0;
      let pendingCount = 0;
      let postDatedCount = 0;
      let overdueCount = 0;
      let dishonoredCount = 0;
      let dueTodayCount = 0;
      let clearedTodayCount = 0;

      const processedRows: any[] = [];

      for (const row of allRows as any[]) {
        const debit = Number(row.debit || 0);
        const credit = Number(row.credit || 0);
        const rowDueDate = row.due_date ? String(row.due_date).slice(0, 10) : null;
        const rowEntryDate = row.entry_date ? String(row.entry_date).slice(0, 10) : null;
        
        let effectiveStatus = row.status;
        const isOverdue = (row.status === "pending" || row.status === "overdue") && rowDueDate && rowDueDate < todayIso;
        const isDueToday = rowDueDate === todayIso && row.status !== "cleared" && row.status !== "dishonored";

        if (isOverdue && row.status !== "dishonored" && row.status !== "cleared") {
          effectiveStatus = "overdue";
        }

        totalDebit += debit;
        totalCredit += credit;

        // Running balance formula: Opening + Credits - Debits
        running = running + credit - debit;

        if (row.status === "cleared") clearedCount += 1;
        if (row.status === "pending") pendingCount += 1;
        if (row.status === "post_dated") postDatedCount += 1;
        if (effectiveStatus === "overdue") overdueCount += 1;
        if (row.status === "dishonored") dishonoredCount += 1;
        if (isDueToday) dueTodayCount += 1;
        if (row.status === "cleared" && (rowEntryDate === todayIso || String(row.cleared_at || "").slice(0, 10) === todayIso)) {
          clearedTodayCount += 1;
        }

        processedRows.push({
          ...row,
          effective_status: effectiveStatus,
          is_due_today: isDueToday,
          is_overdue: isOverdue,
          running_balance: running,
          debit,
          credit
        });
      }

      // Tab filtering if requested
      let filteredRows = processedRows;
      if (tab === "cleared") {
        filteredRows = processedRows.filter((r) => r.status === "cleared");
      } else if (tab === "pending") {
        filteredRows = processedRows.filter((r) => r.status === "pending" && !r.is_overdue);
      } else if (tab === "post_dated") {
        filteredRows = processedRows.filter((r) => r.status === "post_dated");
      } else if (tab === "overdue") {
        filteredRows = processedRows.filter((r) => r.effective_status === "overdue");
      } else if (tab === "dishonored") {
        filteredRows = processedRows.filter((r) => r.status === "dishonored");
      } else if (tab === "due_today") {
        filteredRows = processedRows.filter((r) => r.is_due_today);
      }

      // Apply requested sort order
      if (sortBy === "entry_date" && sortDir === "desc") {
        filteredRows.reverse();
      }

      const totalCount = filteredRows.length;
      const closingBalance = openingBalance + totalCredit - totalDebit;

      const offset = (page - 1) * pageSize;
      const paginatedEntries = filteredRows.slice(offset, offset + pageSize);

      return {
        entries: paginatedEntries,
        totalCount,
        page,
        pageSize,
        summary: {
          totalEntries: processedRows.length,
          openingBalance,
          totalDebit,
          totalCredit,
          closingBalance,
          clearedCount,
          pendingCount,
          postDatedCount,
          overdueCount,
          dishonoredCount,
          dueTodayCount,
          clearedTodayCount
        }
      };
    });

    if (!result) {
      throw new Error("Unable to connect to database");
    }

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await request.json();

    const result = await withLocalPg(async (sql) => {
      // 1. Generate Next Entry Serial
      const lastRows = await sql`
        SELECT entry_serial_number
        FROM public.bank_cheque_transactions
        WHERE entry_serial_number LIKE 'ENT-%'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      let nextNum = 1;
      if (lastRows.length > 0) {
        const lastSerial = lastRows[0].entry_serial_number;
        const numPart = parseInt(lastSerial.replace(/\D/g, ""), 10);
        if (!isNaN(numPart)) nextNum = numPart + 1;
      }
      const entrySerial = `ENT-${String(nextNum).padStart(4, "0")}`;

      const debit = Number(body.debit || 0);
      const credit = Number(body.credit || 0);
      const today = new Date().toISOString().slice(0, 10);
      const dueDate = body.dueDate || body.chequeDate || today;

      let status = body.status || "pending";
      if (status === "pending" && dueDate > today) {
        status = "post_dated";
      }

      const auditTrail = [
        {
          action: "created",
          actor: session.fullName || "User",
          actor_id: session.userId,
          timestamp: new Date().toISOString(),
          notes: body.notes || "Bank cheque transaction created"
        }
      ];

      const inserted = await sql`
        INSERT INTO public.bank_cheque_transactions (
          company_id, country_id, country_branch_id, city_branch_id,
          entry_serial_number, voucher_no, journal_no,
          entry_date, entry_time,
          user_id, user_name, bank_id, bank_name, bank_code,
          cheque_no, particulars, cheque_date, due_date,
          debit, credit, currency, status,
          ledger_id, counter_ledger_id, notes, audit_trail
        ) VALUES (
          ${body.companyId || null}, ${body.countryId || null}, ${body.countryBranchId || null}, ${body.cityBranchId || null},
          ${entrySerial}, ${body.voucherNo || null}, ${body.journalNo || null},
          ${body.entryDate || today}, now(),
          ${session.userId}, ${session.fullName || "User"}, ${body.bankId || null}, ${body.bankName}, ${body.bankCode || null},
          ${body.chequeNo || null}, ${body.particulars}, ${body.chequeDate || today}, ${dueDate},
          ${debit}, ${credit}, ${body.currency || "PKR"}, ${status},
          ${body.ledgerId || null}, ${body.counterLedgerId || null}, ${body.notes || null}, ${JSON.stringify(auditTrail)}
        )
        RETURNING id, entry_serial_number
      `;

      return inserted[0];
    });

    return apiCreated(result);
  } catch (error) {
    return handleApiError(error);
  }
}
