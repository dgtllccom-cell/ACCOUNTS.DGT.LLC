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
 * Daily exchange rate lookup for the Cash Entry form.
 * Wraps the Postgres function get_daily_rate(p_country_id, p_country_branch_id, p_date),
 * which reads the rate entered in the Daily Exchange Rate module (daily_usd_rates).
 * Returns buying / selling / credit / debit rates for the selected country / branch / date.
 * `found` is false when no rate has been entered yet (table empty for that scope/date).
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
        row = Array.isArray(data) ? data[0] : data;
      } else {
        throw error || new Error("RPC returned no data");
      }
    } catch {
      // Fallback: direct query on daily_usd_rates table
      let rateQuery: any = supabase
        .from("daily_usd_rates" as any)
        .select("rate_date, buying_rate, selling_rate, credit_rate, debit_rate, country_branch_id")
        .eq("country_id", countryId)
        .eq("rate_date", targetDate)
        .is("deleted_at", null);

      if (countryBranchId) {
        rateQuery = rateQuery.or(`country_branch_id.eq.${countryBranchId},country_branch_id.is.null`);
      } else {
        rateQuery = rateQuery.is("country_branch_id", null);
      }

      const { data: rows } = await rateQuery;
      if (Array.isArray(rows) && rows.length > 0) {
        rows.sort((a: any, b: any) => {
          if (a.country_branch_id && !b.country_branch_id) return -1;
          if (!a.country_branch_id && b.country_branch_id) return 1;
          return 0;
        });
        const match = rows[0];
        row = {
          rate_date: match.rate_date,
          buying_rate: match.buying_rate,
          selling_rate: match.selling_rate,
          credit_rate: match.credit_rate,
          debit_rate: match.debit_rate,
          is_exact_date: true,
          is_branch_specific: Boolean(match.country_branch_id)
        };
      }
    }

    const found = Boolean(row && (row.buying_rate != null || row.selling_rate != null || row.credit_rate != null || row.debit_rate != null));

    return apiOk({
      found,
      rateDate: row?.rate_date ?? null,
      buyingRate: row?.buying_rate != null ? Number(row.buying_rate) : null,
      sellingRate: row?.selling_rate != null ? Number(row.selling_rate) : null,
      creditRate: row?.credit_rate != null ? Number(row.credit_rate) : null,
      debitRate: row?.debit_rate != null ? Number(row.debit_rate) : null,
      isExactDate: row?.is_exact_date ?? null,
      isBranchSpecific: row?.is_branch_specific ?? null
    });
  } catch (error) {
    return handleApiError(error);
  }
}
