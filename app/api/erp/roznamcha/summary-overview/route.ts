import { assertNotShippingOnly } from "@/lib/permissions/shipping-explicit-gate";
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
    assertNotShippingOnly(session);
    const { searchParams } = new URL(request.url);
    const dateParam = (searchParams.get("date") || new Date().toISOString().slice(0, 10)).trim();
    const filterCountryId = searchParams.get("countryId")?.trim() || null;
    const filterBranchId = searchParams.get("branchId")?.trim() || null;

    // Scope validation for non-super admins
    if (!session.isSuperAdmin) {
      if (filterCountryId && session.countryIds && session.countryIds.length > 0 && !session.countryIds.includes(filterCountryId)) {
        return NextResponse.json({ error: "Access denied to requested country" }, { status: 403 });
      }
      if (filterBranchId && session.cityBranchIds && session.cityBranchIds.length > 0 && !session.cityBranchIds.includes(filterBranchId)) {
        return NextResponse.json({ error: "Access denied to requested branch" }, { status: 403 });
      }
    }

    const supabase = createSupabaseAdminClient();

    const allowedCountryIds = !session.isSuperAdmin && session.countryIds?.length ? session.countryIds : null;
    const allowedBranchIds = !session.isSuperAdmin && session.cityBranchIds?.length ? session.cityBranchIds : null;

    const viaPg = await withLocalPg(async (sql) => {
      const countries = await sql`
        select id, name, iso2, currency_code from public.countries
        where deleted_at is null
          and (${allowedCountryIds ? sql`id = any(${allowedCountryIds})` : sql`true`})
          and (${filterCountryId ? sql`id = ${filterCountryId}` : sql`true`})
        order by name asc
      `;
      const cityBranches = await sql`
        select id, country_id, country_branch_id, name, code, local_currency
        from public.city_branches
        where deleted_at is null
          and (${allowedBranchIds ? sql`id = any(${allowedBranchIds})` : allowedCountryIds ? sql`country_id = any(${allowedCountryIds})` : sql`true`})
          and (${filterCountryId ? sql`country_id = ${filterCountryId}` : sql`true`})
          and (${filterBranchId ? sql`id = ${filterBranchId}` : sql`true`})
        order by name asc
      `;
      const currencyRates = await sql`
        select country_id, from_currency, rate, credit_rate, debit_rate, effective_date, created_at
        from public.currency_rates
        where deleted_at is null and effective_date = ${dateParam}
          and (${allowedCountryIds ? sql`country_id = any(${allowedCountryIds})` : sql`true`})
        order by created_at desc
      `;
      return { countries, cityBranches, currencyRates };
    });

    // 1. Fetch Countries
    const { data: countriesData } = viaPg
      ? { data: viaPg.countries }
      : await (async () => {
          let q = supabase.from("countries").select("id, name, iso2, currency_code").order("name", { ascending: true });
          if (allowedCountryIds) q = q.in("id", allowedCountryIds);
          if (filterCountryId) q = q.eq("id", filterCountryId);
          return q;
        })();

    // 2. Fetch Branches
    const { data: cityBranchesData } = viaPg
      ? { data: viaPg.cityBranches }
      : await (async () => {
          let q = supabase
            .from("city_branches")
            .select("id, country_id, country_branch_id, name, code, local_currency")
            .order("name", { ascending: true });
          if (allowedBranchIds) q = q.in("id", allowedBranchIds);
          else if (allowedCountryIds) q = q.in("country_id", allowedCountryIds);
          if (filterCountryId) q = q.eq("country_id", filterCountryId);
          if (filterBranchId) q = q.eq("id", filterBranchId);
          return q;
        })();

    // 3. Fetch Currency Rates for date
    const { data: currencyRatesData } = viaPg
      ? { data: viaPg.currencyRates }
      : await (async () => {
          let q = supabase
            .from("currency_rates")
            .select("country_id, from_currency, rate, credit_rate, debit_rate, effective_date, created_at")
            .is("deleted_at", null)
            .eq("effective_date", dateParam)
            .order("created_at", { ascending: false });
          if (allowedCountryIds) q = q.in("country_id", allowedCountryIds);
          return q;
        })();

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
        select id, country_id, country_branch_id, city_branch_id, entry_date, voucher_no, narration, created_at, created_by
        from public.roznamcha_entries
        where deleted_at is null
          and entry_date = ${dateParam}
          and (${allowedCountryIds ? sql`country_id = any(${allowedCountryIds})` : sql`true`})
          and (${allowedBranchIds ? sql`city_branch_id = any(${allowedBranchIds})` : sql`true`})
          and (${filterCountryId ? sql`country_id = ${filterCountryId}` : sql`true`})
          and (${filterBranchId ? sql`city_branch_id = ${filterBranchId}` : sql`true`})
        order by created_at desc
      `;
      const entryIds = (entryRows as any[]).map((r: any) => r.id);
      const lineRows = entryIds.length
        ? await sql`
            select rl.id, rl.roznamcha_entry_id, rl.debit, rl.credit, rl.currency, rl.description,
                   coalesce(ea.name, acc.name, led.name, rl.description, '—') as party_name
            from public.roznamcha_lines rl
            left join public.enterprise_accounts ea on ea.id = rl.enterprise_account_id
            left join public.accounts acc on acc.id = rl.account_id
            left join public.ledgers led on led.id = rl.ledger_id
            where rl.roznamcha_entry_id = any(${entryIds})
          `
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
          voucher_no,
          narration,
          created_at,
          created_by,
          roznamcha_lines (
            id,
            debit,
            credit,
            currency,
            description
          )
        `)
        .is("deleted_at", null)
        .eq("entry_date", dateParam);

      if (allowedCountryIds) {
        entriesQuery = entriesQuery.in("country_id", allowedCountryIds);
      }
      if (allowedBranchIds) {
        entriesQuery = entriesQuery.in("city_branch_id", allowedBranchIds);
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

    // Aggregate totals by Country & Branch, including detailed transactions for drilldown
    const countryStats: Record<string, {
      totalDebit: number;
      totalCredit: number;
      entryCount: number;
      branches: Record<string, {
        totalDebit: number;
        totalCredit: number;
        entryCount: number;
        transactions: Array<{
          id: string;
          voucherNo: string;
          time: string;
          narration: string;
          partyName: string;
          debit: number;
          credit: number;
          currency: string;
        }>;
      }>;
    }> = {};

    (entriesData || []).forEach((entry: any) => {
      const cId = entry.country_id || "UNASSIGNED";
      const bId = entry.city_branch_id || entry.country_branch_id || "GENERAL";

      if (!countryStats[cId]) {
        countryStats[cId] = { totalDebit: 0, totalCredit: 0, entryCount: 0, branches: {} };
      }
      if (!countryStats[cId].branches[bId]) {
        countryStats[cId].branches[bId] = { totalDebit: 0, totalCredit: 0, entryCount: 0, transactions: [] };
      }

      countryStats[cId].entryCount += 1;
      countryStats[cId].branches[bId].entryCount += 1;

      let entryDr = 0;
      let entryCr = 0;
      let party = "—";
      let lineCurr = "—";

      (entry.roznamcha_lines || []).forEach((line: any) => {
        const dr = Number(line.debit || 0);
        const cr = Number(line.credit || 0);
        countryStats[cId].totalDebit += dr;
        countryStats[cId].totalCredit += cr;
        countryStats[cId].branches[bId].totalDebit += dr;
        countryStats[cId].branches[bId].totalCredit += cr;

        entryDr += dr;
        entryCr += cr;
        if (line.party_name && line.party_name !== "—") party = line.party_name;
        if (line.currency) lineCurr = line.currency;
      });

      countryStats[cId].branches[bId].transactions.push({
        id: entry.id,
        voucherNo: entry.voucher_no || entry.id.slice(0, 8),
        time: entry.created_at ? new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—",
        narration: entry.narration || "—",
        partyName: party,
        debit: entryDr,
        credit: entryCr,
        currency: lineCurr
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
          const bStats = stats.branches[b.id] || { totalDebit: 0, totalCredit: 0, entryCount: 0, transactions: [] };
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
            entryCount: bStats.entryCount,
            transactions: bStats.transactions
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

    return NextResponse.json({
      date: dateParam,
      isSuperAdmin: Boolean(session.isSuperAdmin),
      countries: countriesList
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    console.error("Error in country-cash-summary GET:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch summary overview" }, { status: err?.status || 500 });
  }
}
