import { NextRequest } from "next/server";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createApiSupabaseClient } from "@/lib/api/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Branch-wise cash summary for the Cash Entry dashboard.
 * Wraps the Postgres function get_branch_cash_summary(p_country_id, p_country_branch_id, p_date).
 * Returns Total Debit, Total Credit, Balance (Credit - Debit) and Entry count for the
 * selected country / branch / date.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();

    const countryId = request.nextUrl.searchParams.get("countryId")?.trim() || "";
    const countryBranchId = request.nextUrl.searchParams.get("countryBranchId")?.trim() || "";
    const date = request.nextUrl.searchParams.get("date")?.trim() || "";

    if (!countryId || !UUID_RE.test(countryId)) {
      throw new ApiClientError("A valid countryId is required.");
    }
    if (countryBranchId && !UUID_RE.test(countryBranchId)) {
      throw new ApiClientError("countryBranchId must be a valid id.");
    }
    if (date && !DATE_RE.test(date)) {
      throw new ApiClientError("date must be in YYYY-MM-DD format.");
    }

    // Enforce that the caller is allowed to read this country/branch scope.
    authorizeApiScope(session, {
      resource: "roznamcha",
      action: "read",
      countryId,
      countryBranchId: countryBranchId || null
    });

    const supabase = await createApiSupabaseClient();
    let totalDebit = 0;
    let totalCredit = 0;
    let entryCount = 0;

    const targetDate = date || new Date().toISOString().slice(0, 10);

    try {
      const { data, error } = await supabase.rpc("get_branch_cash_summary", {
        p_country_id: countryId,
        p_country_branch_id: countryBranchId || null,
        p_date: targetDate
      });

      if (!error && data) {
        const row = (Array.isArray(data) ? data[0] : data) as any;
        totalDebit = Number(row?.total_debit ?? 0);
        totalCredit = Number(row?.total_credit ?? 0);
        entryCount = Number(row?.entry_count ?? 0);
      } else {
        throw error || new Error("RPC returned no data");
      }
    } catch {
      // Fallback: direct query on roznamcha_entries and roznamcha_lines
      let query = supabase
        .from("roznamcha_entries")
        .select("id, roznamcha_lines(debit, credit)")
        .eq("country_id", countryId)
        .eq("entry_date", targetDate)
        .is("deleted_at", null);

      if (countryBranchId) {
        query = query.eq("country_branch_id", countryBranchId);
      }

      const { data: fallbackEntries } = await query;
      if (Array.isArray(fallbackEntries)) {
        entryCount = fallbackEntries.length;
        for (const entry of fallbackEntries) {
          if (Array.isArray(entry.roznamcha_lines)) {
            for (const line of entry.roznamcha_lines) {
              totalDebit += Number(line.debit || 0);
              totalCredit += Number(line.credit || 0);
            }
          }
        }
      }
    }

    const balance = totalCredit - totalDebit;

    return apiOk({
      countryId,
      countryBranchId: countryBranchId || null,
      date: date || new Date().toISOString().slice(0, 10),
      totalDebit,
      totalCredit,
      balance: Math.abs(balance),
      balanceRaw: balance,
      balanceType: balance > 0 ? "Cr" : balance < 0 ? "Dr" : "-",
      entryCount
    });
  } catch (error) {
    return handleApiError(error);
  }
}
