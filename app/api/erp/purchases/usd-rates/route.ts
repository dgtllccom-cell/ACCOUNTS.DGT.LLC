import { NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { authorize } from "@/lib/permissions/middleware";
import { handleApiError, rethrowIfNextControlFlow } from "@/lib/api/response";
import { withLocalPg } from "@/lib/db/local-postgres";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/purchases/usd-rates — the latest ACTIVE daily rate per currency (units of currency per 1 USD), read-only.
 * Source: daily_usd_rates (the same table the Daily Exchange Rate screen maintains); rate = buying rate, selling rate as fallback — the same
 * baseline rule as /api/erp/currency/latest-rate. The approved Purchase headers use it ONLY to show a mixed-currency total in USD and show
 * "—" for any currency that has no active rate.
 */
export async function GET() {
  try {
    // same gate as the Purchase pages that show these figures: purchases:read
    authorize(await requireErpSession(), { resource: "purchases", action: "read" });
    const rows = (await withLocalPg((sql: any) => sql`
      select distinct on (coalesce(d.currency_code, c.currency_code))
             coalesce(d.currency_code, c.currency_code) as currency_code,
             d.buying_rate, d.selling_rate, d.updated_at
      from public.daily_usd_rates d
      left join public.countries c on c.id = d.country_id
      where d.deleted_at is null and d.superseded_at is null and coalesce(d.currency_code, c.currency_code) is not null
      order by coalesce(d.currency_code, c.currency_code), d.rate_date desc, d.effective_from desc
    `)) as { currency_code: string; buying_rate: string | number | null; selling_rate: string | number | null; updated_at: string }[] | null;
    const rates: Record<string, number> = {};
    let updatedAt: string | null = null;
    for (const r of rows ?? []) {
      const c = String(r.currency_code || "").toUpperCase();
      const v = Number(r.buying_rate) > 0 ? Number(r.buying_rate) : Number(r.selling_rate);
      if (c && v > 0) {
        rates[c] = v;
        if (!updatedAt || new Date(r.updated_at) > new Date(updatedAt)) updatedAt = r.updated_at;
      }
    }
    return NextResponse.json({ ok: true, data: { rates, updatedAt } });
  } catch (e) {
    rethrowIfNextControlFlow(e);
    return handleApiError(e);
  }
}
