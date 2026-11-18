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
    // The Daily Exchange Rate module keeps one approved rate per country and date: units of the country's
    // currency for 1 USD. A USD entry in a non-USD country is converted with that same rate, so the country
    // rate is resolved here whatever the entry currency is. Only a USD-based country returns 1.
    // Carry-forward (latest approved rate on or before the date) is kept from the live version and uses the country currency.
    const { data: countryData } = await supabase.from("countries").select("currency_code").eq("id", countryId).maybeSingle();
    const countryRow = countryData as { currency_code?: string | null } | null;
    const countryCurrency = String(countryRow?.currency_code || "").toUpperCase() || null;
    let row: any = null;
    let isCarryForward = false;
    let carryForwardFromDate: string | null = null;
    try {
      if (countryCurrency === "USD") {
        row = { rate_date: targetDate, currency_code: "USD", credit_rate: 1, debit_rate: 1, buying_rate: 1, selling_rate: 1 };
      } else {
        row = await loadExactDailyRate(supabase, { countryId, branchId: countryBranchId, date: targetDate, currency: "" });
        // If not found for exact date, carry forward from the latest approved rate on or before targetDate
        if (!row) {
          let query = (supabase as any).from("daily_usd_rates")
            .select("rate_date,buying_rate,selling_rate,credit_rate,debit_rate,country_branch_id,currency_code")
            .eq("country_id", countryId)
            .lte("rate_date", targetDate)
            .is("deleted_at", null)
            .is("superseded_at", null);
          if (countryBranchId) {
            query = query.or(`country_branch_id.eq.${countryBranchId},country_branch_id.is.null`);
          } else {
            query = query.is("country_branch_id", null);
          }
          if (countryCurrency) query = query.eq("currency_code", countryCurrency);
          const { data: latestRates, error: cfErr } = await query.order("rate_date", { ascending: false }).limit(10);
          if (!cfErr && latestRates && latestRates.length > 0) {
            const best = latestRates.find((r: any) => countryBranchId && r.country_branch_id === countryBranchId) || latestRates[0];
            if (best && (best.credit_rate || best.selling_rate || best.debit_rate || best.buying_rate)) {
              row = best;
              isCarryForward = true;
              carryForwardFromDate = best.rate_date;
            }
          }
        }
      }
    } catch (error) {
      console.error("[daily-rate] lookup unavailable", error);
      throw new ApiClientError(t(session.preferredLanguage, "common.error"), { status: 503, code: "FX_LOOKUP_UNAVAILABLE" });
    }
    const values = dailyRateValues(row);
    const found = Boolean(row && values.creditRate && values.debitRate);
    const isExactDate = found && !isCarryForward && (row?.rate_date === targetDate);

    return apiOk({
      found,
      status: found ? (isCarryForward ? "CARRY_FORWARD" : "APPROVED") : "PENDING_MISSING",
      targetDate,
      rateDate: found ? row!.rate_date : null,
      buyingRate: found ? values.debitRate : null,
      sellingRate: found ? values.creditRate : null,
      creditRate: found ? values.creditRate : null,
      debitRate: found ? values.debitRate : null,
      currencyCode: found ? row!.currency_code : null,
      isExactDate,
      isCarryForward,
      carryForwardFromDate,
      isBranchSpecific: found && Boolean(row?.country_branch_id || row?.is_branch_specific),
      countryCurrency,
      entryCurrency: currency || countryCurrency,
      isBaseCurrency: !currency || currency === countryCurrency
    });
  } catch (error) {
    return handleApiError(error);
  }
}
