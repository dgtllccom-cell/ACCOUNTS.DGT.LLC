import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Centralized FX resolver. Reuses the append-only `currency_rates` table.
 * Every transaction resolves the rate that was ACTIVE at the moment it was
 * created (created_at <= at), so historical transactions never change when a
 * new rate is entered later. No duplicate rate logic anywhere else.
 */

/** Rate to convert 1 unit of `fromCurrency` into USD, active at time `atISO`. */
export async function getRateToUsdAt(
  fromCurrency: string,
  countryId: string | null,
  atISO?: string
): Promise<number | null> {
  const cur = (fromCurrency || "").trim().toUpperCase();
  if (!cur || cur === "USD") return 1;
  const at = atISO || new Date().toISOString();
  const admin = createSupabaseAdminClient() as any;
  try {
    let q = admin
      .from("currency_rates")
      .select("rate, country_id, created_at")
      .is("deleted_at", null)
      .eq("from_currency", cur)
      .lte("created_at", at)
      .order("created_at", { ascending: false })
      .limit(1);
    // Prefer the country-specific rate; fall back to a global (null-country) rate.
    if (countryId) q = q.or(`country_id.eq.${countryId},country_id.is.null`);
    const { data, error } = await q;
    if (error || !data || !data.length) {
      // fall back to any rate for this currency
      const { data: any2 } = await admin
        .from("currency_rates")
        .select("rate")
        .is("deleted_at", null)
        .eq("from_currency", cur)
        .lte("created_at", at)
        .order("created_at", { ascending: false })
        .limit(1);
      return any2 && any2.length ? Number(any2[0].rate) : null;
    }
    return Number(data[0].rate);
  } catch {
    return null;
  }
}

/** Convert `amount` of `fromCurrency` to USD using the rate active at `atISO`. */
export async function convertToUsdAt(
  amount: number,
  fromCurrency: string,
  countryId: string | null,
  atISO?: string
): Promise<{ usd: number | null; rate: number | null }> {
  const rate = await getRateToUsdAt(fromCurrency, countryId, atISO);
  if (rate == null || !isFinite(amount)) return { usd: null, rate };
  return { usd: amount * rate, rate };
}

/**
 * Exchange gain/loss between the rate booked at transaction time and the rate
 * at settlement time (e.g., purchase booked in USD, paid later in AED).
 * Positive => gain, negative => loss (in USD terms).
 */
export async function exchangeGainLoss(params: {
  amount: number;
  fromCurrency: string;
  countryId: string | null;
  bookedAtISO: string;
  settledAtISO?: string;
}): Promise<{ gainLossUsd: number | null; bookedRate: number | null; settledRate: number | null }> {
  const bookedRate = await getRateToUsdAt(params.fromCurrency, params.countryId, params.bookedAtISO);
  const settledRate = await getRateToUsdAt(params.fromCurrency, params.countryId, params.settledAtISO);
  if (bookedRate == null || settledRate == null || !isFinite(params.amount)) {
    return { gainLossUsd: null, bookedRate, settledRate };
  }
  return { gainLossUsd: params.amount * (settledRate - bookedRate), bookedRate, settledRate };
}
