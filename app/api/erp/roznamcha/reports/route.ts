/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createApiSupabaseClient } from "@/lib/api/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type RoznamchaEntryCategory = "business" | "bank" | "cash" | "invoice" | "transfer";

const SELECT_COLUMNS =
  "id, type, entry_category, country_id, countries(name,currency_code), country_branch_id, country_branches(name,code), city_branch_id, city_branches(name,code), journal_no, voucher_no, entry_date, posted_at, reference_no, source_reference_no, source_module, source_transaction_type, narration, status, created_by, profiles!roznamcha_entries_created_by_fkey(full_name), created_at, roznamcha_lines(id, payment_entry_type, debit, credit, currency, ledger_id, ledgers(name, code))";

const DEBIT_LEAN_TYPES = new Set(["cash_receipt", "bank_deposit", "debit"]);

function isDebitLine(paymentEntryType: string | null | undefined) {
  return DEBIT_LEAN_TYPES.has(String(paymentEntryType ?? ""));
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const scope = getScopeFromSearchParams(request);
    const params = request.nextUrl.searchParams;

    authorizeApiScope(session, { resource: "roznamcha", action: "read", ...scope });

    const entryCategory = params.get("entryCategory")?.trim() as RoznamchaEntryCategory | "all" | null;
    const fromDate = params.get("fromDate")?.trim();
    const toDate = params.get("toDate")?.trim();
    const userId = params.get("userId")?.trim();
    const ledgerId = params.get("accountId")?.trim() || params.get("ledgerId")?.trim();
    const debitCredit = params.get("debitCredit")?.trim(); // "debit" | "credit"
    const currency = params.get("currency")?.trim();
    const referenceNo = params.get("referenceNo")?.trim();
    const billNo = params.get("billNo")?.trim();
    const status = params.get("status")?.trim();
    const q = params.get("q")?.trim();
    const sortBy = params.get("sortBy")?.trim() || "entry_date";
    const sortDir = params.get("sortDir")?.trim() === "asc" ? "asc" : "desc";
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params.get("pageSize")) || 25));

    const supabase = await createApiSupabaseClient();
    let query = supabase.from("roznamcha_entries").select(SELECT_COLUMNS).is("deleted_at", null) as any;

    if (entryCategory && entryCategory !== "all") {
      query = query.eq("entry_category", entryCategory);
    }
    if (scope.countryId) query = query.eq("country_id", scope.countryId);
    if (scope.countryBranchId) query = query.eq("country_branch_id", scope.countryBranchId);
    if (scope.cityBranchId) query = query.eq("city_branch_id", scope.cityBranchId);
    if (fromDate) query = query.gte("entry_date", fromDate);
    if (toDate) query = query.lte("entry_date", toDate);
    if (userId) query = query.eq("created_by", userId);
    if (status) query = query.eq("status", status);
    if (referenceNo) query = query.ilike("reference_no", `%${referenceNo.replace(/[%,]/g, "")}%`);
    if (billNo) {
      const safeBillNo = billNo.replace(/[%,]/g, "");
      query = query.or(`source_reference_no.ilike.%${safeBillNo}%,reference_no.ilike.%${safeBillNo}%`);
    }
    if (q) {
      const safeQ = q.replace(/[%,]/g, "");
      query = query.or(
        [
          `journal_no.ilike.%${safeQ}%`,
          `voucher_no.ilike.%${safeQ}%`,
          `reference_no.ilike.%${safeQ}%`,
          `narration.ilike.%${safeQ}%`
        ].join(",")
      );
    }

    // Restrict non-super users to their explicit role assignments (same rule as the
    // existing GET /api/erp/roznamcha handler).
    if (!session.isSuperAdmin) {
      const orConditions = [
        ...new Set(
          session.assignments
            .map((assignment) => {
              if (assignment.cityBranchId) return `city_branch_id.eq.${assignment.cityBranchId}`;
              if (assignment.countryBranchId) return `country_branch_id.eq.${assignment.countryBranchId}`;
              if (assignment.countryId) return `country_id.eq.${assignment.countryId}`;
              return null;
            })
            .filter((condition): condition is string => Boolean(condition))
        )
      ];
      query = orConditions.length ? query.or(orConditions.join(",")) : query.eq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { data, error } = await query.order(sortBy, { ascending: sortDir === "asc" });
    if (error) throw new Error(error.message);

    let rows = (data ?? []) as any[];

    // Line-level filters (ledger/currency/debit-credit) applied in-memory after the entry-level
    // query above — current data volume is small; this keeps the query simple and correct without
    // depending on PostgREST embedded-resource filter syntax edge cases.
    if (ledgerId) {
      rows = rows.filter((row) => (row.roznamcha_lines ?? []).some((line: any) => line.ledger_id === ledgerId));
    }
    if (currency) {
      rows = rows.filter((row) => (row.roznamcha_lines ?? []).some((line: any) => line.currency === currency));
    }
    if (debitCredit === "debit" || debitCredit === "credit") {
      rows = rows.filter((row) =>
        (row.roznamcha_lines ?? []).some((line: any) => isDebitLine(line.payment_entry_type) === (debitCredit === "debit"))
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;
    let postedCount = 0;
    let pendingCount = 0;
    for (const row of rows) {
      const lines = row.roznamcha_lines ?? [];
      const primaryLine = lines[0];
      if (primaryLine) {
        const amt = Number(primaryLine.debit || primaryLine.credit || 0);
        if (isDebitLine(primaryLine.payment_entry_type)) totalDebit += amt;
        else totalCredit += amt;
      }
      if (row.status === "posted" || row.status === "transferred") postedCount += 1;
      else pendingCount += 1;
    }

    const totalCount = rows.length;
    const offset = (page - 1) * pageSize;
    const pageRows = rows.slice(offset, offset + pageSize);

    return apiOk({
      entries: pageRows,
      totalCount,
      page,
      pageSize,
      totalDebit,
      totalCredit,
      netBalance: totalDebit - totalCredit,
      postedCount,
      pendingCount
    });
  } catch (error) {
    return handleApiError(error);
  }
}
