import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorizeApiScope } from "@/lib/api/scope-middleware";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Daily Exchange Rate Management (Super Admin).
 * Reuses the existing `currency_rates` table (per-currency, date-wise, to USD)
 * + `exchange_rate_history` for the audit trail. NO new rate tables.
 *
 * APPEND-ONLY (per business rule): a rate is NEVER overwritten or deleted.
 * If the rate changes during the day, a NEW row is inserted with its own
 * effective timestamp (created_at). The "current" rate for a currency is the
 * most recently entered row; every transaction resolves the rate that was
 * active at the moment it was created (see lib/services/fx.ts getRateAt).
 */
export async function GET(req: Request) {
  try {
    const session = await requireErpSession();
    authorizeApiScope(session, { resource: "currency_rates", action: "read" });
    const { searchParams } = new URL(req.url);
    const date = (searchParams.get("date") || new Date().toISOString().slice(0, 10)).trim();
    const history = searchParams.get("history") === "true";

    const supabase = createSupabaseAdminClient();
    let q = supabase
      .from("currency_rates")
      .select("id, country_id, from_currency, to_currency, rate, credit_rate, debit_rate, effective_date, created_at")
      .is("deleted_at", null)
      .eq("effective_date", date)
      .order("created_at", { ascending: false });
    if (!session.isSuperAdmin && session.countryIds && session.countryIds.length > 0) {
      q = q.or(`country_id.in.(${session.countryIds.join(",")}),country_id.is.null`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const all = data || [];
    if (history) return NextResponse.json({ date, rates: all }); // full intraday history

    // Latest (current) rate per currency+country — history rows are kept, just not shown here.
    const seen = new Set<string>();
    const latest = all.filter((r: any) => {
      const key = `${r.country_id ?? "-"}::${r.from_currency}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return NextResponse.json({ date, rates: latest });
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
    // Two accounting rates: Credit + Debit (entered by the Country Admin each morning).
    const creditRate = Number(body.creditRate ?? body.rate);
    const debitRate = Number(body.debitRate ?? body.rate);
    const effectiveDate = (body.effectiveDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    // Country: super admins may target any country; others are scoped to their own.
    const countryId = body.countryId ?? (session.isSuperAdmin ? null : session.countryIds?.[0] ?? null);

    if (!fromCurrency) return NextResponse.json({ error: "fromCurrency is required" }, { status: 400 });
    if (!(creditRate > 0)) return NextResponse.json({ error: "creditRate must be greater than 0" }, { status: 400 });
    if (!(debitRate > 0)) return NextResponse.json({ error: "debitRate must be greater than 0" }, { status: 400 });

    const supabase = createSupabaseAdminClient();

    // Read the previous latest rate ONLY to record old_rate in history.
    // APPEND-ONLY: we never update or delete the previous row.
    let prevQ = supabase
      .from("currency_rates")
      .select("id, rate")
      .is("deleted_at", null)
      .eq("from_currency", fromCurrency)
      .order("created_at", { ascending: false })
      .limit(1);
    prevQ = countryId ? prevQ.eq("country_id", countryId) : prevQ.is("country_id", null);
    const { data: prevRows } = await prevQ;
    const existing = prevRows && prevRows.length ? prevRows[0] : null;

    const { data, error } = await supabase
      .from("currency_rates")
      .insert({
        country_id: countryId,
        from_currency: fromCurrency,
        to_currency: "USD",
        rate: creditRate, // primary (NOT NULL) — kept in sync with credit_rate
        credit_rate: creditRate,
        debit_rate: debitRate,
        effective_date: effectiveDate,
        created_by: session.userId,
      })
      .select("id, country_id, from_currency, to_currency, rate, credit_rate, debit_rate, effective_date, created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Audit trail (non-fatal).
    try {
      await supabase.from("exchange_rate_history").insert({
        country_id: countryId,
        from_currency: fromCurrency,
        to_currency: "USD",
        old_rate: existing?.rate ?? null,
        new_rate: creditRate,
        effective_date: effectiveDate,
        changed_by: session.userId,
        reason: body.reason ?? `Daily accounting rate (credit ${creditRate} / debit ${debitRate})`,
      });
    } catch { /* history is best-effort */ }

    return NextResponse.json({ rate: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
