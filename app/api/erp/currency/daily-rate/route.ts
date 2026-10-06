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
 * Daily exchange rate lookup for Cash Entry, Roznamcha, Purchase, Sales, Shipping & reports.
 * Strictly resolves against the requested date and country-level authoritative rate.
 * Never silently returns an old date or arbitrary fallback.
 * `found` is true ONLY when an approved rate exists for that exact date.
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

    authorizeApiScope(session, {
      resource: "roznamcha",
      action: "read",
      countryId,
      countryBranchId: countryBranchId || null
    });

    const supabase = await createApiSupabaseClient();
    const targetDate = date || new Date().toISOString().slice(0, 10);
    let row: any = null;

    try {
      const { data, error } = await supabase.rpc("get_daily_rate", {
        p_country_id: countryId,
        p_country_branch_id: countryBranchId || null,
        p_date: targetDate
      });

      if (!error && data) {
        const rows = Array.isArray(data) ? data : [data];
        if (rows.length > 0 && rows[0]?.rate_date === targetDate) {
          row = rows[0];
        }
      }
    } catch {
      // Fallback: direct query on daily_usd_rates table
      const { data: rows } = await supabase
        .from("daily_usd_rates" as any)
        .select("rate_date, buying_rate, selling_rate, credit_rate, debit_rate, country_branch_id, currency_code")
        .eq("country_id", countryId)
        .eq("rate_date", targetDate)
        .is("deleted_at", null)
        .order("effective_from", { ascending: false } as any)
        .limit(1);

      if (Array.isArray(rows) && rows.length > 0) {
        const match = rows[0];
        row = {
          rate_date: match.rate_date,
          buying_rate: match.buying_rate,
          selling_rate: match.selling_rate,
          credit_rate: match.credit_rate,
          debit_rate: match.debit_rate,
          is_exact_date: true,
          is_branch_specific: Boolean(match.country_branch_id),
          currency_code: match.currency_code
        };
      }
    }

    const isExactMatch = Boolean(row && String(row.rate_date).slice(0, 10) === targetDate);
    const hasRateValues = Boolean(
      row &&
      (row.buying_rate != null || row.selling_rate != null || row.credit_rate != null || row.debit_rate != null) &&
      (Number(row.credit_rate ?? row.selling_rate) > 0 || Number(row.debit_rate ?? row.buying_rate) > 0)
    );

    const found = isExactMatch && hasRateValues;

    return apiOk({
      found,
      status: found ? "APPROVED" : "PENDING_MISSING",
      targetDate,
      rateDate: found ? row.rate_date : null,
      buyingRate: found && row.buying_rate != null ? Number(row.buying_rate) : (found ? Number(row.debit_rate) : null),
      sellingRate: found && row.selling_rate != null ? Number(row.selling_rate) : (found ? Number(row.credit_rate) : null),
      creditRate: found && row.credit_rate != null ? Number(row.credit_rate) : (found ? Number(row.selling_rate) : null),
      debitRate: found && row.debit_rate != null ? Number(row.debit_rate) : (found ? Number(row.buying_rate) : null),
      currencyCode: found ? row.currency_code : null,
      isExactDate: found,
      isBranchSpecific: false // Authoritative country-wide rate
    });
  } catch (error) {
    return handleApiError(error);
  }
}
