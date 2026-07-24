import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Persistent global store on Node.js globalThis so HMR doesn't reset rates
declare global {
  var __daily_exchange_rates_store__: any[] | undefined;
}

const DEFAULT_RATES = [
  {
    id: "rate-af-1",
    country_id: "c-af",
    user_name: "SUPER ADMIN",
    branch_name: "Kabul Main Branch",
    rate_date: new Date().toISOString().slice(0, 10),
    rate_time: "10:49 PM",
    buying_rate: 68.00,
    selling_rate: 67.00,
    credit_rate: 67.00,
    debit_rate: 68.00,
    updated_at: new Date().toISOString(),
    countries: { name: "Afghanistan", currency_code: "AFN", iso2: "AF" }
  },
  {
    id: "rate-pk-1",
    country_id: "c-pk",
    user_name: "SUPER ADMIN",
    branch_name: "Pakistan Main Branch",
    rate_date: new Date().toISOString().slice(0, 10),
    rate_time: "09:15 AM",
    buying_rate: 278.50,
    selling_rate: 280.00,
    credit_rate: 280.00,
    debit_rate: 278.50,
    updated_at: new Date().toISOString(),
    countries: { name: "Pakistan", currency_code: "PKR", iso2: "PK" }
  },
  {
    id: "rate-ae-1",
    country_id: "c-ae",
    user_name: "SUPER ADMIN",
    branch_name: "Dubai Central Branch",
    rate_date: new Date().toISOString().slice(0, 10),
    rate_time: "10:30 AM",
    buying_rate: 3.67,
    selling_rate: 3.68,
    credit_rate: 3.68,
    debit_rate: 3.67,
    updated_at: new Date().toISOString(),
    countries: { name: "United Arab Emirates", currency_code: "AED", iso2: "AE" }
  },
  {
    id: "rate-us-1",
    country_id: "c-us",
    user_name: "SUPER ADMIN",
    branch_name: "USA Division",
    rate_date: new Date().toISOString().slice(0, 10),
    rate_time: "08:00 AM",
    buying_rate: 1.00,
    selling_rate: 1.00,
    credit_rate: 1.00,
    debit_rate: 1.00,
    updated_at: new Date().toISOString(),
    countries: { name: "United States", currency_code: "USD", iso2: "US" }
  },
  {
    id: "rate-sa-1",
    country_id: "c-sa",
    user_name: "SUPER ADMIN",
    branch_name: "Riyadh Branch",
    rate_date: new Date().toISOString().slice(0, 10),
    rate_time: "11:00 AM",
    buying_rate: 3.75,
    selling_rate: 3.76,
    credit_rate: 3.76,
    debit_rate: 3.75,
    updated_at: new Date().toISOString(),
    countries: { name: "Saudi Arabia", currency_code: "SAR", iso2: "SA" }
  }
];

function getStore(): any[] {
  if (!globalThis.__daily_exchange_rates_store__ || globalThis.__daily_exchange_rates_store__.length === 0) {
    globalThis.__daily_exchange_rates_store__ = [...DEFAULT_RATES];
  }
  return globalThis.__daily_exchange_rates_store__;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const countryId = searchParams.get("countryId");
    const branchName = searchParams.get("branchName");
    const query = searchParams.get("query")?.toLowerCase()?.trim();

    // 1. Try Supabase if table exists
    try {
      const supabase = createSupabaseAdminClient() as any;
      const { data, error } = await supabase
        .from("daily_exchange_rates")
        .select("*, countries(name, currency_code, iso2)")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        let dbResults = data;
        if (countryId && countryId !== "all") dbResults = dbResults.filter((r: any) => r.country_id === countryId);
        if (query) dbResults = dbResults.filter((r: any) => r.user_name?.toLowerCase().includes(query) || r.branch_name?.toLowerCase().includes(query));
        return NextResponse.json({ ok: true, data: dbResults, rates: dbResults });
      }
    } catch {
      // Ignore database table missing and fallback to store
    }

    // 2. Fallback to process global store
    let results = [...getStore()];

    if (countryId && countryId !== "all") {
      results = results.filter(r => r.country_id === countryId);
    }

    if (branchName && branchName !== "all") {
      results = results.filter(r => r.branch_name?.toLowerCase().includes(branchName.toLowerCase()));
    }

    if (query && query.trim() !== "") {
      results = results.filter(r => 
        r.user_name?.toLowerCase().includes(query) ||
        r.branch_name?.toLowerCase().includes(query) ||
        r.countries?.name?.toLowerCase().includes(query) ||
        r.countries?.currency_code?.toLowerCase().includes(query)
      );
    }

    return NextResponse.json({ ok: true, data: results, rates: results });
  } catch {
    const store = getStore();
    return NextResponse.json({ ok: true, data: store, rates: store });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { countryId, rateDate, rateTime, buyingRate, sellingRate, creditRate, debitRate, countryName, currencyCode, iso2, userName, branchName } = body;

    const newRate = {
      id: `rate-${Date.now()}`,
      country_id: countryId,
      user_name: userName || "SUPER ADMIN",
      branch_name: branchName || "Pakistan Main Branch",
      rate_date: rateDate || new Date().toISOString().slice(0, 10),
      rate_time: rateTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

    // 1. Try Supabase insert
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
        selling_rate: newRate.selling_rate,
      });
    } catch {
      // Ignore
    }

    // 2. Prepend to global process memory store
    const store = getStore();
    const existingIdx = store.findIndex(r => r.country_id === countryId && r.rate_date === newRate.rate_date);
    if (existingIdx >= 0) {
      store[existingIdx] = newRate;
    } else {
      store.unshift(newRate);
    }

    return NextResponse.json({
      ok: true,
      data: newRate,
      rates: [...store]
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to save rate" }, { status: 400 });
  }
}
