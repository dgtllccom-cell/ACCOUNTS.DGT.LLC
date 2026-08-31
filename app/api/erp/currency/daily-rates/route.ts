import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Daily Exchange Rate register — backed by the real `daily_usd_rates` table
 * (the same table Cash Entry / Roznamcha posting reads for FX resolution).
 *
 * A rate is stored as: how many units of the local currency (PKR, AED, …) = 1 USD.
 * Rates are APPENDED, never overwritten — each save is a new row with its own
 * `effective_from` instant, so the same country/branch can have several rates in
 * one day and every historical transaction keeps the rate it was posted against.
 */

function mapRow(row: any) {
  return {
    id: row.id,
    country_id: row.country_id,
    country_branch_id: row.country_branch_id ?? null,
    rate_date: row.rate_date,
    rate_time: row.rate_time ?? null,
    effective_from: row.effective_from ?? null,
    superseded_at: row.superseded_at ?? null,
    currency_code: row.currency_code ?? row.countries?.currency_code ?? null,
    buying_rate: row.buying_rate != null ? Number(row.buying_rate) : null,
    selling_rate: row.selling_rate != null ? Number(row.selling_rate) : null,
    credit_rate: row.credit_rate != null ? Number(row.credit_rate) : null,
    debit_rate: row.debit_rate != null ? Number(row.debit_rate) : null,
    user_name: row.user_name ?? null,
    branch_name: row.branch_name ?? null,
    entered_by: row.entered_by ?? null,
    approved_by: row.approved_by ?? null,
    approved_at: row.approved_at ?? null,
    created_at: row.created_at ?? null,
    countries: row.countries ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const { searchParams } = new URL(req.url);
    const countryId = searchParams.get("countryId");
    const countryBranchId = searchParams.get("countryBranchId");
    const branchName = searchParams.get("branchName");
    const query = searchParams.get("query")?.toLowerCase().trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const supabase = createSupabaseAdminClient() as any;
    let q = supabase
      .from("daily_usd_rates")
      .select("*, countries(name, currency_code, iso2)")
      .is("deleted_at", null)
      .order("effective_from", { ascending: false })
      .limit(1000);

    // Backend scope: non-super-admin only sees their assigned countries.
    if (!session.isSuperAdmin && Array.isArray(session.countryIds) && session.countryIds.length > 0) {
      q = q.in("country_id", session.countryIds);
    }
    if (countryId && countryId !== "all") q = q.eq("country_id", countryId);
    if (countryBranchId && countryBranchId !== "all") q = q.eq("country_branch_id", countryBranchId);
    if (dateFrom) q = q.gte("rate_date", dateFrom);
    if (dateTo) q = q.lte("rate_date", dateTo);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    let rows = (Array.isArray(data) ? data : []).map(mapRow);
    if (branchName && branchName !== "all") {
      rows = rows.filter((r) => (r.branch_name || "").toLowerCase().includes(branchName.toLowerCase()));
    }
    if (query) {
      rows = rows.filter(
        (r) =>
          (r.user_name || "").toLowerCase().includes(query) ||
          (r.branch_name || "").toLowerCase().includes(query) ||
          (r.countries?.name || "").toLowerCase().includes(query) ||
          (r.currency_code || "").toLowerCase().includes(query)
      );
    }

    return NextResponse.json({ ok: true, data: rows, rates: rows });
  } catch (error: any) {
    if (typeof error?.digest === "string" && error.digest.startsWith("NEXT_")) throw error;
    if (error?.message === "NEXT_REDIRECT" || error?.message === "NEXT_NOT_FOUND") throw error;
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load exchange rates" }, { status: error?.status ?? 500 });
  }
}

function parseEffectiveFrom(rateDate: string, rateTime: string | undefined | null): string {
  const date = rateDate || new Date().toISOString().slice(0, 10);
  const raw = String(rateTime || "").trim();
  // "02:00 PM" / "14:00" / "2:00 pm"
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const ap = m[3]?.toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    const hh = String(h).padStart(2, "0");
    const mm = String(min).padStart(2, "0");
    return `${date}T${hh}:${mm}:00`;
  }
  // no parseable time — use "now" so an intraday save takes effect immediately
  return new Date().toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireErpSession();
    const body = await req.json();
    const {
      countryId,
      countryBranchId,
      rateDate,
      rateTime,
      buyingRate,
      sellingRate,
      creditRate,
      debitRate,
      currencyCode,
      userName,
      branchName,
    } = body;

    if (!countryId) {
      return NextResponse.json({ ok: false, error: "countryId is required." }, { status: 400 });
    }
    // Backend scope guard — a country/branch user may only maintain rates for its own scope.
    if (!session.isSuperAdmin && Array.isArray(session.countryIds) && session.countryIds.length > 0 && !session.countryIds.includes(countryId)) {
      return NextResponse.json({ ok: false, error: "Country scope is not allowed for this user." }, { status: 403 });
    }

    const credit = Number(creditRate ?? sellingRate);
    const debit = Number(debitRate ?? buyingRate);
    if (!(credit > 0) || !(debit > 0)) {
      return NextResponse.json({ ok: false, error: "Credit and Debit rates must both be greater than zero." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient() as any;

    // resolve currency + branch name if not supplied
    let currency = currencyCode ? String(currencyCode).toUpperCase() : null;
    if (!currency) {
      const { data: c } = await supabase.from("countries").select("currency_code").eq("id", countryId).maybeSingle();
      currency = c?.currency_code ? String(c.currency_code).toUpperCase() : null;
    }
    let resolvedBranchName = branchName || null;
    if (!resolvedBranchName && countryBranchId) {
      const { data: b } = await supabase.from("country_branches").select("name").eq("id", countryBranchId).maybeSingle();
      resolvedBranchName = b?.name || null;
    }

    const effectiveFrom = parseEffectiveFrom(rateDate, rateTime);

    // APPEND a new rate row (never overwrite an existing one → same-day history preserved).
    const insertRow = {
      country_id: countryId,
      country_branch_id: countryBranchId || null,
      rate_date: rateDate || new Date().toISOString().slice(0, 10),
      rate_time: rateTime || null,
      effective_from: effectiveFrom,
      currency_code: currency,
      buying_rate: Number(buyingRate ?? debit),
      selling_rate: Number(sellingRate ?? credit),
      credit_rate: credit,
      debit_rate: debit,
      entered_by: session.userId || null,
      user_name: userName || session.fullName || session.email || "ERP USER",
      branch_name: resolvedBranchName || "Country level",
    };

    const { data: inserted, error } = await supabase
      .from("daily_usd_rates")
      .insert(insertRow)
      .select("*, countries(name, currency_code, iso2)")
      .single();

    if (error) {
      // unique (country, branch, effective_from) collision → bump by a second and retry once
      if (String(error.message).toLowerCase().includes("duplicate")) {
        const bumped = new Date(new Date(effectiveFrom).getTime() + 1000).toISOString();
        const retry = await supabase
          .from("daily_usd_rates")
          .insert({ ...insertRow, effective_from: bumped })
          .select("*, countries(name, currency_code, iso2)")
          .single();
        if (retry.error) throw new Error(retry.error.message);
        return NextResponse.json({ ok: true, data: mapRow(retry.data) });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, data: mapRow(inserted) });
  } catch (error: any) {
    if (typeof error?.digest === "string" && error.digest.startsWith("NEXT_")) throw error;
    if (error?.message === "NEXT_REDIRECT" || error?.message === "NEXT_NOT_FOUND") throw error;
    return NextResponse.json({ ok: false, error: error?.message || "Failed to save rate" }, { status: error?.status ?? 400 });
  }
}
