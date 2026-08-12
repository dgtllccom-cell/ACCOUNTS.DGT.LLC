import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  var __daily_exchange_rates_store__: any[] | undefined;
}

function getStore(): any[] {
  if (!globalThis.__daily_exchange_rates_store__) {
    globalThis.__daily_exchange_rates_store__ = [];
  }
  return globalThis.__daily_exchange_rates_store__;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    const countryId = searchParams.get("countryId");
    const branchName = searchParams.get("branchName");
    const query = searchParams.get("query")?.toLowerCase().trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    try {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase
        .from("daily_exchange_rates")
        .select("*, countries(name, currency_code, iso2)")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        let dbResults = data;

        if (!session.isSuperAdmin && session.countryIds.length > 0) {
          dbResults = dbResults.filter((row: any) => session.countryIds.includes(row.country_id));
        }
        if (countryId && countryId !== "all") {
          dbResults = dbResults.filter((row: any) => row.country_id === countryId);
        }
        if (branchName && branchName !== "all") {
          dbResults = dbResults.filter((row: any) => row.branch_name?.toLowerCase().includes(branchName.toLowerCase()));
        }
        if (dateFrom) {
          dbResults = dbResults.filter((row: any) => row.rate_date >= dateFrom);
        }
        if (dateTo) {
          dbResults = dbResults.filter((row: any) => row.rate_date <= dateTo);
        }
        if (query) {
          dbResults = dbResults.filter(
            (row: any) =>
              row.user_name?.toLowerCase().includes(query) ||
              row.branch_name?.toLowerCase().includes(query) ||
              row.countries?.name?.toLowerCase().includes(query) ||
              row.countries?.currency_code?.toLowerCase().includes(query)
          );
        }

        return NextResponse.json({ ok: true, data: dbResults, rates: dbResults });
      }
    } catch {
      // Fall back to local process memory for local/dev workflows.
    }

    let results = [...getStore()];
    if (!session.isSuperAdmin && session.countryIds.length > 0) {
      results = results.filter((row) => session.countryIds.includes(row.country_id));
    }
    if (countryId && countryId !== "all") {
      results = results.filter((row) => row.country_id === countryId);
    }
    if (branchName && branchName !== "all") {
      results = results.filter((row) => row.branch_name?.toLowerCase().includes(branchName.toLowerCase()));
    }
    if (dateFrom) {
      results = results.filter((row) => row.rate_date >= dateFrom);
    }
    if (dateTo) {
      results = results.filter((row) => row.rate_date <= dateTo);
    }
    if (query) {
      results = results.filter(
        (row) =>
          row.user_name?.toLowerCase().includes(query) ||
          row.branch_name?.toLowerCase().includes(query) ||
          row.countries?.name?.toLowerCase().includes(query) ||
          row.countries?.currency_code?.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({ ok: true, data: results, rates: results });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load exchange rates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await req.json();
    const {
      countryId,
      rateDate,
      rateTime,
      buyingRate,
      sellingRate,
      creditRate,
      debitRate,
      countryName,
      currencyCode,
      iso2,
      userName,
      branchName
    } = body;

    if (!session.isSuperAdmin && session.countryIds.length > 0 && countryId && !session.countryIds.includes(countryId)) {
      return NextResponse.json({ ok: false, error: "Country scope is not allowed for this user." }, { status: 403 });
    }

    const newRate = {
      id: `rate-${Date.now()}`,
      country_id: countryId,
      user_name: userName || session.fullName || session.email || "ERP USER",
      branch_name: branchName || "Scope Assigned",
      rate_date: rateDate || new Date().toISOString().slice(0, 10),
      rate_time: rateTime || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      buying_rate: Number(buyingRate),
      selling_rate: Number(sellingRate),
      credit_rate: Number(creditRate || sellingRate),
      debit_rate: Number(debitRate || buyingRate),
      updated_at: new Date().toISOString(),
      countries: {
        name: countryName || "Country",
        currency_code: currencyCode || "USD",
        iso2: iso2 || null
      }
    };

    try {
      const supabase = createSupabaseAdminClient() as any;
      await supabase.from("daily_exchange_rates").insert({
        country_id: countryId,
        user_name: newRate.user_name,
        branch_name: newRate.branch_name,
        rate_date: newRate.rate_date,
        rate_time: newRate.rate_time,
        credit_rate: newRate.credit_rate,
        debit_rate: newRate.debit_rate,
        buying_rate: newRate.buying_rate,
        selling_rate: newRate.selling_rate
      });
    } catch {
      // Local/dev should continue even if the backing table is unavailable.
    }

    const store = getStore();
    const existingIndex = store.findIndex((row) => row.country_id === countryId && row.rate_date === newRate.rate_date);
    if (existingIndex >= 0) store[existingIndex] = newRate;
    else store.unshift(newRate);

    return NextResponse.json({
      ok: true,
      data: newRate,
      rates: [...store]
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to save rate" }, { status: 400 });
  }
}
