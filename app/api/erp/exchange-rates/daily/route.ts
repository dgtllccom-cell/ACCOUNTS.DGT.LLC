import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Daily Exchange Rate Management (Super Admin).
 * Reuses the existing `currency_rates` table (per-currency, date-wise, to USD)
 * + `exchange_rate_history` for the audit trail. NO new rate tables.
 * Each currency (USD/AED/PKR/INR/AFN/IRR/TRY/CNY/EUR/...) keeps its own daily
 * rate to USD; history is preserved (one active row per country+currency+date).
 */
export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "currency_rates", action: "read" });
    const { searchParams } = new URL(req.url);
    const date = (searchParams.get("date") || new Date().toISOString().slice(0, 10)).trim();

    const supabase = createSupabaseAdminClient();
    let q = supabase
      .from("currency_rates")
      .select("id, country_id, from_currency, to_currency, rate, effective_date, created_at")
      .is("deleted_at", null)
      .eq("effective_date", date)
      .order("from_currency", { ascending: true });
    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      q = q.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ date, rates: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "currency_rates", action: "create" });
    const body = await req.json();

    const fromCurrency = typeof body.fromCurrency === "string" ? body.fromCurrency.trim().toUpperCase() : "";
    const rate = Number(body.rate);
    const effectiveDate = (body.effectiveDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    // Country: super admins may target any country; others are scoped to their own.
    const countryId = body.countryId ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);

    if (!fromCurrency) return NextResponse.json({ error: "fromCurrency is required" }, { status: 400 });
    if (!(rate > 0)) return NextResponse.json({ error: "rate must be greater than 0" }, { status: 400 });

    const supabase = createSupabaseAdminClient();

    // Find the current active rate (for history old_rate + supersede).
    let existingQ = supabase
      .from("currency_rates")
      .select("id, rate")
      .is("deleted_at", null)
      .eq("from_currency", fromCurrency)
      .eq("effective_date", effectiveDate);
    existingQ = countryId ? existingQ.eq("country_id", countryId) : existingQ.is("country_id", null);
    const { data: existing } = await existingQ.maybeSingle();

    // Supersede the previous rate for this country+currency+date (keep history).
    if (existing) {
      await supabase.from("currency_rates").update({ deleted_at: new Date().toISOString() }).eq("id", existing.id);
    }

    const { data, error } = await supabase
      .from("currency_rates")
      .insert({
        country_id: countryId,
        from_currency: fromCurrency,
        to_currency: "USD",
        rate,
        effective_date: effectiveDate,
        created_by: session.userId,
      })
      .select("id, country_id, from_currency, to_currency, rate, effective_date, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Audit trail (non-fatal).
    try {
      await supabase.from("exchange_rate_history").insert({
        country_id: countryId,
        from_currency: fromCurrency,
        to_currency: "USD",
        old_rate: existing?.rate ?? null,
        new_rate: rate,
        effective_date: effectiveDate,
        changed_by: session.userId,
        reason: body.reason ?? "Daily rate update",
      });
    } catch { /* history is best-effort */ }

    return NextResponse.json({ rate: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
