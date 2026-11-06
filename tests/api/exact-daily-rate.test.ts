import { describe, expect, it, vi } from "vitest";
import { loadExactDailyRate, cashDirectionRate, cashUsdEquivalent, dailyRateValues } from "@/lib/currency/exact-daily-rate";
const input = { countryId: "pk", branchId: "chaman", date: "2026-11-06", currency: "PKR", now: new Date("2026-11-06T12:00:00Z") };
const row = { rate_date: input.date, currency_code: "PKR", buying_rate: 280, selling_rate: 282, country_branch_id: null };
function db(rpcData: any, rpcError: any = null, recovered: any[] = [], recoveryError: any = null) {
  const q: any = {};
  for (const m of ["select", "eq", "is", "lte", "or", "order"]) q[m] = vi.fn(() => q);
  q.limit = vi.fn(async () => ({ data: recovered, error: recoveryError }));
  return { rpc: vi.fn(async () => ({ data: rpcData, error: rpcError })), from: vi.fn(() => q), q };
}
describe("authoritative exact-date cash FX", () => {
  it("uses the single four-argument database signature", async () => {
    const client = db([row]);
    expect(await loadExactDailyRate(client, input)).toEqual(row);
    expect(client.rpc).toHaveBeenCalledWith("get_daily_rate", { p_country_id: "pk", p_country_branch_id: "chaman", p_date: input.date, p_at: "2026-11-06T12:00:00.000Z" });
    expect(client.from).not.toHaveBeenCalled();
  });
  it("recovers a returned RPC error from the same table within exact branch/date/currency", async () => {
    const specific = { ...row, country_branch_id: "chaman", buying_rate: 281 };
    const client = db(null, { code: "PGRST203" }, [row, specific]);
    expect(await loadExactDailyRate(client, input)).toEqual(specific);
    expect(client.from).toHaveBeenCalledWith("daily_usd_rates");
    expect(client.q.eq).toHaveBeenCalledWith("country_id", "pk");
    expect(client.q.eq).toHaveBeenCalledWith("rate_date", input.date);
    expect(client.q.eq).toHaveBeenCalledWith("currency_code", "PKR");
    expect(client.q.is).toHaveBeenCalledWith("superseded_at", null);
    expect(client.q.is).toHaveBeenCalledWith("deleted_at", null);
    expect(client.q.or).toHaveBeenCalledWith("country_branch_id.eq.chaman,country_branch_id.is.null");
  });
  it.each([
    { ...row, rate_date: "2026-11-05" }, { ...row, currency_code: "AED" }, { ...row, country_branch_id: "quetta" },
  ])("never accepts stale dates, other currencies or another branch", async (bad) => {
    expect(await loadExactDailyRate(db([bad], null, [bad]), input)).toBeNull();
  });
  it("distinguishes a lookup outage from an absent rate", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(loadExactDailyRate(db(null, { message: "RPC unavailable" }, [], { message: "RLS denied" }), input)).rejects.toThrow("unavailable");
    expect(await loadExactDailyRate(db([], null), input)).toBeNull();
    vi.restoreAllMocks();
  });
  it("uses a past date cutoff and never future effective corrections", async () => {
    const client = db(null, { code: "RPC_ERROR" });
    await loadExactDailyRate(client, { ...input, date: "2026-11-05" });
    expect(client.q.lte).toHaveBeenCalledWith("effective_from", "2026-11-05T23:59:59.999Z");
  });
  it("preserves DR/buy and CR/sell mapping for PKR 20,000", () => {
    expect(dailyRateValues(row)).toEqual({ debitRate: 280, creditRate: 282 });
    const rates = { debitRate: 280, creditRate: 282 };
    expect(cashUsdEquivalent(20000, "PKR", cashDirectionRate(rates, "DEBIT"))).toBe(71.4286);
    expect(cashUsdEquivalent(20000, "PKR", cashDirectionRate(rates, "CREDIT"))).toBe(70.922);
    expect(cashDirectionRate({ creditRate: 282 }, "DEBIT")).toBeNull();
    expect(cashUsdEquivalent(20000, "PKR", 0)).toBeNull();
    expect(cashUsdEquivalent(20000, "PKR", null)).toBeNull();
    expect(cashUsdEquivalent(20000, "USD", null)).toBe(20000);
    expect(cashUsdEquivalent(1000, "AED", 3.67)).toBe(272.4796);
  });
});
