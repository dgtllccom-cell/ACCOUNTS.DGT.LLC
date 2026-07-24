import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function add(map: Map<string, any>, key: string, patch: Record<string, unknown>) {
  const current = map.get(key) ?? {};
  map.set(key, { ...current, ...patch });
  return map.get(key);
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const countryId = request.nextUrl.searchParams.get("countryId");

    const supabase = createSupabaseAdminClient() as any;

    let countryQuery = supabase
      .from("countries")
      .select("id, name, iso2, iso3, currency_code")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (countryId) countryQuery = countryQuery.eq("id", countryId);
    if (!session.isSuperAdmin) {
      const allowed = session.countryIds.length ? session.countryIds : ["00000000-0000-0000-0000-000000000000"];
      countryQuery = countryQuery.in("id", allowed);
    }

    const { data: countriesData, error: countriesError } = await countryQuery;
    if (countriesError) throw new Error(countriesError.message);

    const countries = (countriesData ?? []) as Array<{
      id: string;
      name: string;
      iso2: string | null;
      iso3: string | null;
      currency_code: string;
    }>;
    const countryIds = countries.map((country) => country.id);

    let rateQuery = supabase
      .from("daily_usd_rates")
      .select("country_id, country_branch_id, rate_date, buying_rate, selling_rate, credit_rate, debit_rate, updated_at")
      .in("country_id", countryIds.length ? countryIds : ["00000000-0000-0000-0000-000000000000"])
      .is("deleted_at", null)
      .is("country_branch_id", null)
      .order("rate_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1000);
    const { data: ratesData, error: ratesError } = await rateQuery;
    if (ratesError) throw new Error(ratesError.message);

    const latestRateByCountry = new Map<string, any>();
    for (const row of ratesData ?? []) {
      if (!latestRateByCountry.has(row.country_id)) latestRateByCountry.set(row.country_id, row);
    }

    let lineQuery = supabase
      .from("roznamcha_lines")
      .select(
        "debit, credit, currency, usd_rate, usd_amount, roznamcha_entries!inner(country_id, entry_date, status)"
      )
      .in("roznamcha_entries.country_id", countryIds.length ? countryIds : ["00000000-0000-0000-0000-000000000000"]);
    if (from) lineQuery = lineQuery.gte("roznamcha_entries.entry_date", from);
    if (to) lineQuery = lineQuery.lte("roznamcha_entries.entry_date", to);

    const { data: linesData, error: linesError } = await lineQuery.limit(10000);
    if (linesError) throw new Error(linesError.message);

    const byCountry = new Map<string, any>();
    for (const country of countries) {
      const rate = latestRateByCountry.get(country.id);
      add(byCountry, country.id, {
        countryId: country.id,
        countryName: country.name,
        countryCode: country.iso3 || country.iso2 || country.currency_code,
        currency: country.currency_code,
        latestBuyRate: toNumber(rate?.buying_rate),
        latestSellRate: toNumber(rate?.selling_rate),
        latestDebitRate: toNumber(rate?.debit_rate),
        latestCreditRate: toNumber(rate?.credit_rate),
        rateDate: rate?.rate_date ?? null,
        rateUpdatedAt: rate?.updated_at ?? null,
        localDebit: 0,
        localCredit: 0,
        localBalance: 0,
        usdDebit: 0,
        usdCredit: 0,
        usdBalance: 0,
        transactionCount: 0
      });
    }

    if (!session.isSuperAdmin) {
      return apiOk({
        isSuperAdmin: false,
        message: "Global USD monitoring is available to Super Admin only. You can update active rates for your assigned country.",
        countries: [...byCountry.values()],
        totals: {
          localDebit: 0,
          localCredit: 0,
          localBalance: 0,
          usdDebit: 0,
          usdCredit: 0,
          usdBalance: 0,
          transactionCount: 0
        }
      });
    }

    for (const line of linesData ?? []) {
      const entry = Array.isArray(line.roznamcha_entries) ? line.roznamcha_entries[0] : line.roznamcha_entries;
      const key = entry?.country_id;
      if (!key) continue;
      const row = byCountry.get(key);
      if (!row) continue;

      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);
      const usdAmount = toNumber(line.usd_amount);
      row.localDebit += debit;
      row.localCredit += credit;
      row.localBalance += debit - credit;
      row.usdDebit += debit > 0 ? usdAmount : 0;
      row.usdCredit += credit > 0 ? usdAmount : 0;
      row.usdBalance += debit > 0 ? usdAmount : -usdAmount;
      row.transactionCount += 1;
    }

    const rows = [...byCountry.values()];
    const totals = rows.reduce(
      (sum, row) => ({
        localDebit: sum.localDebit + row.localDebit,
        localCredit: sum.localCredit + row.localCredit,
        localBalance: sum.localBalance + row.localBalance,
        usdDebit: sum.usdDebit + row.usdDebit,
        usdCredit: sum.usdCredit + row.usdCredit,
        usdBalance: sum.usdBalance + row.usdBalance,
        transactionCount: sum.transactionCount + row.transactionCount
      }),
      { localDebit: 0, localCredit: 0, localBalance: 0, usdDebit: 0, usdCredit: 0, usdBalance: 0, transactionCount: 0 }
    );

    return apiOk({
      isSuperAdmin: true,
      countries: rows,
      totals
    });
  } catch (error) {
    return handleApiError(error);
  }
}
