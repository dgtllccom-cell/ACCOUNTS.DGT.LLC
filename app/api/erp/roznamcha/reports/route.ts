/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { authorizeApiScope, getScopeFromSearchParams } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createApiSupabaseClient } from "@/lib/api/supabase";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type RoznamchaEntryCategory = "business" | "bank" | "cash" | "invoice" | "transfer";

const SELECT_COLUMNS =
  "id, type, entry_category, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, entry_serial_number, country_id, countries(name,currency_code), country_branch_id, country_branches(name,code), city_branch_id, city_branches(name,code), journal_no, voucher_no, entry_date, posted_at, reference_no, source_reference_no, source_module, source_transaction_type, narration, status, created_by, profiles!roznamcha_entries_created_by_fkey(full_name), created_at, roznamcha_lines(id, payment_entry_type, debit, credit, currency, account_number, ledger_id, ledgers(name, code))";

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

    // Root-cause bypass (see postRoznamchaWithErpSession in app/api/erp/roznamcha/route.ts):
    // roznamcha_entries_scope_read-style RLS gates on is_super_admin()/can_access_*(), all
    // keyed off auth.uid(), which is always NULL under the app's temp-session bootstrap
    // login — so the Supabase-client query below silently returns zero rows even for
    // entries that exist. Try a direct-Postgres read first; fall back to the Supabase-client
    // path only when DATABASE_URL isn't configured.
    const viaPg = await withLocalPg(async (sql) => {
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
        if (cityIds.length === 0 && countryBranchIds.length === 0 && countryIds.length === 0) {
          return [] as any[];
        }
      }

      const safeBillNo = billNo ? billNo.replace(/[%,]/g, "") : null;
      const safeQ = q ? q.replace(/[%,]/g, "") : null;
      const safeRef = referenceNo ? referenceNo.replace(/[%,]/g, "") : null;

      let orderFragment;
      switch (sortBy) {
        case "voucher_no": orderFragment = sortDir === "asc" ? sql`order by e.voucher_no asc` : sql`order by e.voucher_no desc`; break;
        case "journal_no": orderFragment = sortDir === "asc" ? sql`order by e.journal_no asc` : sql`order by e.journal_no desc`; break;
        case "status": orderFragment = sortDir === "asc" ? sql`order by e.status asc` : sql`order by e.status desc`; break;
        case "created_at": orderFragment = sortDir === "asc" ? sql`order by e.created_at asc` : sql`order by e.created_at desc`; break;
        default: orderFragment = sortDir === "asc" ? sql`order by e.entry_date asc` : sql`order by e.entry_date desc`; break;
      }

      const entryRows = await sql`
        select
          e.id, e.type, e.entry_category, e.super_admin_serial_number, e.country_transaction_serial_number,
          e.branch_transaction_serial_number, e.entry_serial_number, e.country_id, e.country_branch_id, e.city_branch_id,
          e.journal_no, e.voucher_no, e.entry_date, e.posted_at, e.reference_no, e.source_reference_no,
          e.source_module, e.source_transaction_type, e.narration, e.status, e.created_by, e.created_at,
          case when c.id is not null then jsonb_build_object('name', c.name, 'currency_code', c.currency_code) else null end as countries,
          case when cb.id is not null then jsonb_build_object('name', cb.name, 'code', cb.code) else null end as country_branches,
          case when cib.id is not null then jsonb_build_object('name', cib.name, 'code', cib.code) else null end as city_branches,
          case when cp.id is not null then jsonb_build_object('full_name', cp.full_name) else null end as profiles
        from public.roznamcha_entries e
        left join public.countries c on c.id = e.country_id
        left join public.country_branches cb on cb.id = e.country_branch_id
        left join public.city_branches cib on cib.id = e.city_branch_id
        left join public.profiles cp on cp.id = e.created_by
        where e.deleted_at is null
          and (${entryCategory && entryCategory !== "all" ? sql`e.entry_category = ${entryCategory}` : sql`true`})
          and (${scope.countryId ? sql`e.country_id = ${scope.countryId}` : sql`true`})
          and (${scope.countryBranchId ? sql`e.country_branch_id = ${scope.countryBranchId}` : sql`true`})
          and (${scope.cityBranchId ? sql`e.city_branch_id = ${scope.cityBranchId}` : sql`true`})
          and (${fromDate ? sql`e.entry_date >= ${fromDate}` : sql`true`})
          and (${toDate ? sql`e.entry_date <= ${toDate}` : sql`true`})
          and (${userId ? sql`e.created_by = ${userId}` : sql`true`})
          and (${status ? sql`e.status = ${status}` : sql`true`})
          and (${safeRef ? sql`e.reference_no ilike ${"%" + safeRef + "%"}` : sql`true`})
          and (${safeBillNo ? sql`(e.source_reference_no ilike ${"%" + safeBillNo + "%"} or e.reference_no ilike ${"%" + safeBillNo + "%"})` : sql`true`})
          and (${safeQ ? sql`(
                e.journal_no ilike ${"%" + safeQ + "%"}
                or e.voucher_no ilike ${"%" + safeQ + "%"}
                or e.reference_no ilike ${"%" + safeQ + "%"}
                or e.narration ilike ${"%" + safeQ + "%"}
              )` : sql`true`})
          and (${session.isSuperAdmin
            ? sql`true`
            : sql`(e.city_branch_id = any(${cityIds}) or e.country_branch_id = any(${countryBranchIds}) or e.country_id = any(${countryIds}))`})
        ${orderFragment}
      `;

      const entryIds = (entryRows as any[]).map((r: any) => r.id);
      const lineRows = entryIds.length
        ? await sql`
            select
              rl.id, rl.roznamcha_entry_id, rl.payment_entry_type, rl.debit, rl.credit, rl.currency, rl.account_number, rl.ledger_id,
              case when l.id is not null then jsonb_build_object('name', l.name, 'code', l.code) else null end as ledgers
            from public.roznamcha_lines rl
            left join public.ledgers l on l.id = rl.ledger_id
            where rl.roznamcha_entry_id = any(${entryIds})
          `
        : [];

      const linesByEntry = new Map<string, any[]>();
      for (const line of lineRows as any[]) {
        const key = line.roznamcha_entry_id;
        if (!linesByEntry.has(key)) linesByEntry.set(key, []);
        linesByEntry.get(key)!.push(line);
      }

      return (entryRows as any[]).map((e) => ({ ...e, roznamcha_lines: linesByEntry.get(e.id) ?? [] }));
    });

    let rows: any[];
    if (viaPg) {
      rows = viaPg;
    } else {
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
      rows = (data ?? []) as any[];
    }

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
