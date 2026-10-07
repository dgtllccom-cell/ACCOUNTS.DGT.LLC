import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { rethrowIfNextControlFlow } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/erp/currency/latest-rate?countryId=&currency=&branchCurrency=&countryBranchId=
 *
 * The latest daily USD rate for a country / branch, in the shape the Cash Entry form and the
 * Currency Monitoring dashboard consume: { rate, buyRate, sellRate, creditRate, debitRate,
 * effectiveDate, source }. It is a thin read-only wrapper over the authoritative daily rate
 * endpoint (/api/erp/currency/daily-rate → get_daily_rate RPC over daily_usd_rates), so the
 * exchange-rate rules, the session check and the roznamcha:read scope all live in one place.
 *
 * `rate` is the baseline conversion rate (buying, then selling as fallback); the forms then
 * pick the debit / credit rate per transaction direction (آمد / خرچ) — rate rules unchanged.
 * `currency` / `branchCurrency` are passed by the callers but do not affect the USD-denominated
 * daily lookup; they are used on the client side only.
 */
export async function GET(req: NextRequest) {
  try {
    // Early auth (the delegated endpoint also enforces session + scope).
    await requireErpSession();

    const sp = req.nextUrl.searchParams;
    const countryId = sp.get("countryId")?.trim() || "";
    const countryBranchId = sp.get("countryBranchId")?.trim() || "";

    const forward = new URLSearchParams();
    if (countryId) forward.set("countryId", countryId);
    if (countryBranchId) forward.set("countryBranchId", countryBranchId);

    const res = await fetch(
      new URL(`/api/erp/currency/daily-rate?${forward.toString()}`, req.url).toString(),
      { headers: { cookie: req.headers.get("cookie") || "" }, cache: "no-store" }
    );
    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      // Surface the delegated status (400 for bad countryId, 403 for scope, etc.).
      return NextResponse.json(
        { rate: 0, source: "unavailable", error: payload?.error || "Failed to read latest rate" },
        { status: res.status }
      );
    }

    // daily-rate returns { ok, data: { found, rateDate, buyingRate, sellingRate, creditRate, debitRate, ... } }
    const d = (payload && (payload.data ?? payload)) || {};
    const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
    const buyRate = num(d.buyingRate);
    const sellRate = num(d.sellingRate);
    const creditRate = num(d.creditRate);
    const debitRate = num(d.debitRate);
    const found = Boolean(d.found) && (buyRate != null || sellRate != null || creditRate != null || debitRate != null);

    return NextResponse.json({
      rate: buyRate ?? sellRate ?? 1,
      buyRate,
      sellRate,
      creditRate,
      debitRate,
      effectiveDate: found ? (d.rateDate ?? null) : null,
      source: found ? "daily_usd_rates" : "default"
    });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ rate: 0, source: "unavailable", error: err?.message || "Failed to read latest rate" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Enforce session before forwarding
    await requireErpSession();
    const body = await req.json();

    // Delegate to daily-rates POST logic
    const res = await fetch(new URL("/api/erp/currency/daily-rates", req.url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "cookie": req.headers.get("cookie") || "" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    rethrowIfNextControlFlow(err);
    return NextResponse.json({ ok: false, error: err?.message || "Failed to update latest rate" }, { status: 400 });
  }
}
