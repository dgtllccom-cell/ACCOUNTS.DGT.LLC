import { NextRequest } from "next/server";
import { t } from "@/lib/i18n/ui";
import { apiOk, handleApiError, ApiClientError } from "@/lib/api/response";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { requireErpSession } from "@/lib/auth/session";
import { createApiSupabaseClient } from "@/lib/api/supabase";

import { loadExactDailyRate, dailyRateValues } from "@/lib/currency/exact-daily-rate";

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
    const currency = request.nextUrl.searchParams.get("currency")?.trim().toUpperCase() || "";
    const cityBranchId = request.nextUrl.searchParams.get("cityBranchId")?.trim() || "";
    if (currency && !/^[A-Z]{3}$/.test(currency)) throw new ApiClientError("currency must be a three-letter code.");
    if (cityBranchId && !UUID_RE.test(cityBranchId)) throw new ApiClientError("cityBranchId must be a valid id.");

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
      countryBranchId: countryBranchId || null, cityBranchId: cityBranchId || null
    });

    const supabase = await createApiSupabaseClient();
    const targetDate = date || new Date().toISOString().slice(0, 10);
    if (!Number.isFinite(Date.parse(`${targetDate}T00:00:00Z`)) || new Date(`${targetDate}T00:00:00Z`).toISOString().slice(0, 10) !== targetDate) throw new ApiClientError("Invalid transaction date.");
    let row;
    try {
      row = currency === "USD" ? { rate_date: targetDate, currency_code: "USD", credit_rate: 1, debit_rate: 1 } :
        await loadExactDailyRate(supabase, { countryId, branchId: countryBranchId, date: targetDate, currency });
    } catch (error) {
      console.error("[daily-rate] lookup unavailable", error);
      throw new ApiClientError(t(session.preferredLanguage, "common.error"), { status: 503, code: "FX_LOOKUP_UNAVAILABLE" });
    }
    const values = dailyRateValues(row);
    const found = Boolean(row && values.creditRate && values.debitRate);

    return apiOk({
      found,
      status: found ? "APPROVED" : "PENDING_MISSING",
      targetDate,
      rateDate: found ? row!.rate_date : null,
      buyingRate: found ? values.debitRate : null,
      sellingRate: found ? values.creditRate : null,
      creditRate: found ? values.creditRate : null,
      debitRate: found ? values.debitRate : null,
      currencyCode: found ? row!.currency_code : null,
      isExactDate: found,
      isBranchSpecific: found && Boolean(row?.country_branch_id || row?.is_branch_specific)
    });
  } catch (error) {
    return handleApiError(error);
  }
}
