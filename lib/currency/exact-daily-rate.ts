export type DailyRateRow = {
  rate_date?: string | null; currency_code?: string | null; country_branch_id?: string | null;
  buying_rate?: number | string | null; selling_rate?: number | string | null;
  debit_rate?: number | string | null; credit_rate?: number | string | null; is_branch_specific?: boolean;
};
export const positiveRate = (value: unknown): number | null => {
  const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null;
};
export function dailyRateValues(row: DailyRateRow | null) {
  return { debitRate: positiveRate(row?.debit_rate ?? row?.buying_rate), creditRate: positiveRate(row?.credit_rate ?? row?.selling_rate) };
}
export function cashDirectionRate(row: { debitRate?: number | null; buyingRate?: number | null; creditRate?: number | null; sellingRate?: number | null } | null, direction: string) {
  return direction === "DEBIT" ? positiveRate(row?.debitRate ?? row?.buyingRate) : positiveRate(row?.creditRate ?? row?.sellingRate);
}
export function cashUsdEquivalent(amount: number, currency: string, rate: number | null) {
  if (!Number.isFinite(amount)) return null;
  const divisor = currency.toUpperCase() === "USD" ? 1 : positiveRate(rate);
  return divisor ? Math.round(amount / divisor * 10000) / 10000 : null;
}

/** Same table and RPC as posting. A recovery read never selects an old date, unrelated branch or currency. */
export async function loadExactDailyRate(db: any, input: { countryId: string; branchId: string; date: string; currency: string; now?: Date }): Promise<DailyRateRow | null> {
  const now = input.now ?? new Date();
  const cutoff = input.date < now.toISOString().slice(0, 10) ? `${input.date}T23:59:59.999Z` : now.toISOString();
  const applicable = (r: DailyRateRow) => String(r.rate_date || "").slice(0, 10) === input.date &&
    (!input.currency || String(r.currency_code || "").toUpperCase() === input.currency) &&
    (!r.country_branch_id || r.country_branch_id === input.branchId) &&
    (!r.is_branch_specific || Boolean(input.branchId));
  let rpcError: unknown;
  try {
    const result = await db.rpc("get_daily_rate", {
      p_country_id: input.countryId, p_country_branch_id: input.branchId || null,
      p_date: input.date, p_at: cutoff,
    });
    if (result.error) throw result.error;
    const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    if (!rows.length) return null;
    if (applicable(rows[0])) return rows[0];
  } catch (error) { rpcError = error; }

  let query = db.from("daily_usd_rates").select("rate_date,buying_rate,selling_rate,credit_rate,debit_rate,country_branch_id,currency_code")
    .eq("country_id", input.countryId).eq("rate_date", input.date).is("deleted_at", null).is("superseded_at", null)
    .lte("effective_from", cutoff);
  query = input.branchId ? query.or(`country_branch_id.eq.${input.branchId},country_branch_id.is.null`) : query.is("country_branch_id", null);
  if (input.currency) query = query.eq("currency_code", input.currency);
  const result = await query.order("effective_from", { ascending: false }).limit(50);
  if (result.error) {
    console.error("[daily-rate] authoritative and recovery reads failed", { rpc: rpcError, fallback: result.error });
    throw new Error("Approved exchange rate lookup is unavailable. Please retry.");
  }
  const rows = (Array.isArray(result.data) ? result.data : []).filter(applicable) as DailyRateRow[];
  return rows.find((row) => Boolean(input.branchId) && row.country_branch_id === input.branchId) ?? rows.find((row) => !row.country_branch_id) ?? null;
}
