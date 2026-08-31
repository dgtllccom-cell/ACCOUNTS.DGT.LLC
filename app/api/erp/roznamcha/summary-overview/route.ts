import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withLocalPg } from "@/lib/db/local-postgres";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(request.url);
    const dateParam = (searchParams.get("date") || new Date().toISOString().slice(0, 10)).trim();
    const filterCountryId = searchParams.get("countryId")?.trim() || null;
    const filterBranchId = searchParams.get("branchId")?.trim() || null;

    const supabase = createSupabaseAdminClient();

    // Root-cause bypass: countries_scope_read / currency_rates_scope_read gate on
    // is_super_admin()/can_access_country(), both keyed off auth.uid(), which is always
    // NULL under the app's temp-session bootstrap login — so the "admin" Supabase client
    // reads below silently return zero rows. Try a direct-Postgres read first (bypasses
    // RLS via DATABASE_URL); fall back to the Supabase-client path only when
    // DATABASE_URL isn't configured.
    const viaPg = await withLocalPg(async (sql) => {
      const countries = await sql`select id, name, iso2, currency_code from public.countries order by name asc`;
      const cityBranches = await sql`
        select id, country_id, country_branch_id, name, code, local_currency
        from public.city_branches
        order by name asc
      `;
      const currencyRates = await sql`
        select country_id, from_currency, rate, credit_rate, debit_rate, effective_date, created_at
        from public.currency_rates
        where deleted_at is null and effective_date = ${dateParam}
        order by created_at desc
      `;
      return { countries, cityBranches, currencyRates };
    });

    // 1. Fetch Countries
    const { data: countriesData } = viaPg
      ? { data: viaPg.countries }
      : await supabase.from("countries").select("id, name, iso2, currency_code").order("name", { ascending: true });

    // 2. Fetch Branches
    const { data: cityBranchesData } = viaPg
      ? { data: viaPg.cityBranches }
      : await supabase
          .from("city_branches")
          .select("id, country_id, country_branch_id, name, code, local_currency")
          .order("name", { ascending: true });

    // 3. Fetch Currency Rates for date
    const { data: currencyRatesData } = viaPg
      ? { data: viaPg.currencyRates }
      : await supabase
          .from("currency_rates")
          .select("country_id, from_currency, rate, credit_rate, debit_rate, effective_date, created_at")
          .is("deleted_at", null)
          .eq("effective_date", dateParam)
          .order("created_at", { ascending: false });

    // Latest rates map by countryId or currency
    const countryRatesMap: Record<string, { creditRate: number | null; debitRate: number | null; buyingRate: number | null; sellingRate: number | null }> = {};
    (currencyRatesData || []).forEach((r: any) => {
      const cId = r.country_id || "GLOBAL";
      if (!countryRatesMap[cId]) {
        countryRatesMap[cId] = {
          creditRate: r.credit_rate != null ? Number(r.credit_rate) : Number(r.rate) || null,
          debitRate: r.debit_rate != null ? Number(r.debit_rate) : Number(r.rate) || null,
          buyingRate: r.credit_rate != null ? Number(r.credit_rate) : Number(r.rate) || null,
          sellingRate: r.debit_rate != null ? Number(r.debit_rate) : Number(r.rate) || null,
        };
      }
    });

    // 4. Fetch Roznamcha Entries & Lines for the date
    const viaPgEntries = await withLocalPg(async (sql) => {
      const entryRows = await sql`
        select id, country_id, country_branch_id, city_branch_id, entry_date
        from public.roznamcha_entries
        where deleted_at is null
          and entry_date = ${dateParam}
          and (${!session.isSuperAdmin && session.countryIds?.length ? sql`country_id = any(${session.countryIds})` : sql`true`})
          and (${!session.isSuperAdmin && session.cityBranchIds?.length ? sql`city_branch_id = any(${session.cityBranchIds})` : sql`true`})
          and (${filterCountryId ? sql`country_id = ${filterCountryId}` : sql`true`})
          and (${filterBranchId ? sql`city_branch_id = ${filterBranchId}` : sql`true`})
      `;
      const entryIds = (entryRows as any[]).map((r: any) => r.id);
      const lineRows = entryIds.length
        ? await sql`select id, roznamcha_entry_id, debit, credit, currency from public.roznamcha_lines where roznamcha_entry_id = any(${entryIds})`
        : [];
      const linesByEntry = new Map<string, any[]>();
      for (const line of lineRows as any[]) {
        const key = line.roznamcha_entry_id;
        if (!linesByEntry.has(key)) linesByEntry.set(key, []);
        linesByEntry.get(key)!.push(line);
      }
      return (entryRows as any[]).map((e) => ({ ...e, roznamcha_lines: linesByEntry.get(e.id) ?? [] }));
    });

    let entriesData: any[] | null = viaPgEntries;
    if (!viaPgEntries) {
      let entriesQuery = supabase
        .from("roznamcha_entries")
        .select(`
          id,
          country_id,
          country_branch_id,
          city_branch_id,
          entry_date,
          roznamcha_lines (
            id,
            debit,
            credit,
            currency
          )
        `)
        .is("deleted_at", null)
        .eq("entry_date", dateParam);

      // Apply Session Scopes if not Super Admin
      if (!session.isSuperAdmin) {
        if (session.countryIds && session.countryIds.length > 0) {
          entriesQuery = entriesQuery.in("country_id", session.countryIds);
        }
        if (session.cityBranchIds && session.cityBranchIds.length > 0) {
          entriesQuery = entriesQuery.in("city_branch_id", session.cityBranchIds);
        }
      }

      if (filterCountryId) {
        entriesQuery = entriesQuery.eq("country_id", filterCountryId);
      }
      if (filterBranchId) {
        entriesQuery = entriesQuery.eq("city_branch_id", filterBranchId);
      }

      const { data, error: entriesError } = await entriesQuery;
      if (entriesError) {
        console.error("Error querying roznamcha entries summary:", entriesError);
      }
      entriesData = data;
    }

    // Aggregate totals by Country & Branch
    const countryStats: Record<string, { totalDebit: number; totalCredit: number; entryCount: number; branches: Record<string, { totalDebit: number; totalCredit: number; entryCount: number }> }> = {};

    (entriesData || []).forEach((entry: any) => {
      const cId = entry.country_id || "UNASSIGNED";
      const bId = entry.city_branch_id || entry.country_branch_id || "GENERAL";

      if (!countryStats[cId]) {
        countryStats[cId] = { totalDebit: 0, totalCredit: 0, entryCount: 0, branches: {} };
      }
      if (!countryStats[cId].branches[bId]) {
        countryStats[cId].branches[bId] = { totalDebit: 0, totalCredit: 0, entryCount: 0 };
      }

      countryStats[cId].entryCount += 1;
      countryStats[cId].branches[bId].entryCount += 1;

      (entry.roznamcha_lines || []).forEach((line: any) => {
        const dr = Number(line.debit || 0);
        const cr = Number(line.credit || 0);
        countryStats[cId].totalDebit += dr;
        countryStats[cId].totalCredit += cr;
        countryStats[cId].branches[bId].totalDebit += dr;
        countryStats[cId].branches[bId].totalCredit += cr;
      });
    });

    // Build final formatted country summary list
    const countriesList = (countriesData || []).map((country: any) => {
      const cId = country.id;
      const stats = countryStats[cId] || { totalDebit: 0, totalCredit: 0, entryCount: 0, branches: {} };
      const rates = countryRatesMap[cId] || countryRatesMap["GLOBAL"] || { buyingRate: null, sellingRate: null, creditRate: null, debitRate: null };

      // Balance convention: Credit - Debit. Positive => Cr, Negative => Dr
      const netBalanceRaw = stats.totalCredit - stats.totalDebit;
      const balance = Math.abs(netBalanceRaw);
      const balanceType = netBalanceRaw > 0 ? "Cr" : netBalanceRaw < 0 ? "Dr" : "-";

      // Branch list for this country
      const countryBranches = (cityBranchesData || [])
        .filter((b: any) => b.country_id === cId)
        .map((b: any) => {
          const bStats = stats.branches[b.id] || { totalDebit: 0, totalCredit: 0, entryCount: 0 };
          const bNet = bStats.totalCredit - bStats.totalDebit;
          return {
            branchId: b.id,
            branchName: b.name,
            branchCode: b.code,
            localCurrency: b.local_currency || country.currency_code,
            totalCredit: bStats.totalCredit,
            totalDebit: bStats.totalDebit,
            balance: Math.abs(bNet),
            balanceRaw: bNet,
            balanceType: bNet > 0 ? "Cr" : bNet < 0 ? "Dr" : "-",
            entryCount: bStats.entryCount
          };
        });

      return {
        countryId: cId,
        countryName: country.name,
        iso2: country.iso2,
        currencyCode: country.currency_code,
        totalCredit: stats.totalCredit,
        totalDebit: stats.totalDebit,
        balance,
        balanceRaw: netBalanceRaw,
        balanceType,
        entryCount: stats.entryCount,
        rates,
        branches: countryBranches
      };
    });

    // Filter list for non-Super Admin session if needed
    let filteredResult = countriesList;
    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      filteredResult = countriesList.filter((c: any) => session.countryIds.includes(c.countryId));
    }

    return NextResponse.json({
      date: dateParam,
      isSuperAdmin: Boolean(session.isSuperAdmin),
      countries: filteredResult
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    console.error("Error in country-cash-summary GET:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch summary overview" }, { status: 500 });
  }
}
