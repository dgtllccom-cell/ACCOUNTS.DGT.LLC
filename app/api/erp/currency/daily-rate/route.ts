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
    const { data, error } = await supabase.rpc("get_daily_rate", {
      p_country_id: countryId,
      p_country_branch_id: countryBranchId || null,
      p_date: date || new Date().toISOString().slice(0, 10)
    });

    if (error) {
      throw new Error(error.message);
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | {
          rate_date?: string | null;
          buying_rate?: number | null;
          selling_rate?: number | null;
          credit_rate?: number | null;
          debit_rate?: number | null;
          is_exact_date?: boolean | null;
          is_branch_specific?: boolean | null;
        }
      | undefined;

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
