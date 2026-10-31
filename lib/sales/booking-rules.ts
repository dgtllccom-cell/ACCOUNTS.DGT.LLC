/**
 * Server-side rules for saving a Sales Booking, independent of what the browser sent:
 *  - a conversion needs a real exchange rate (a missing / zero rate is refused, never replaced by 1);
 *  - goods taken from stock may not exceed the stock lot's remaining balance (open bookings of every branch counted).
 * Goods picked from managed lots are checked by the existing reservation (`reserveForOrder`), so they are skipped here.
 */
import type { ErpSession } from "@/lib/auth/session";
import { ApiClientError } from "@/lib/api/response";
import { listAvailableLots, type SaleSource } from "@/lib/sales/available-lots";
import { resolveBookingRate, stockBalance } from "@/lib/sales/sales-goods-model";

const SOURCES: SaleSource[] = ["warehouse", "booking", "in_transit", "endorse", "local"];
const num = (v: unknown) => {
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};

export function assertBookingCurrency(formData: any): void {
  const form = (formData && typeof formData === "object" ? formData.form : null) ?? {};
  const invoice = String(form.currencyType ?? form.salesCurrency ?? "").trim();
  const settlement = String(form.secondaryCurrency ?? "").trim();
  if (!invoice || !settlement) return; // older drafts carry no pair; the wizard enforces it for new bookings
  const rate = resolveBookingRate({ invoiceCurrency: invoice, settlementCurrency: settlement, exchangeRate: form.exchangeRate, operator: form.operator });
  if (!rate.ok) {
    throw new ApiClientError(
      `An exchange rate is required to convert ${invoice.toUpperCase()} into ${settlement.toUpperCase()}. Enter the rate (or use today's Daily Exchange Rate) before saving.`,
      { status: 422, code: "EXCHANGE_RATE_REQUIRED" }
    );
  }
}

export async function assertSalesWithinStock(
  session: ErpSession,
  formData: any,
  opts: { excludeOrderId?: string | null } = {}
): Promise<void> {
  const goods: any[] = Array.isArray(formData?.goodsEntries) ? formData.goodsEntries : [];
  const wanted = new Map<string, { source: SaleSource; lotNo: string; qty: number; name: string }>();
  for (const g of goods) {
    const lotNo = String(g?.stockLotNo ?? "").trim();
    const source = String(g?.stockSource ?? "").trim() as SaleSource;
    if (!lotNo || g?.managedLotId || !SOURCES.includes(source)) continue;
    const key = `${source}|${lotNo}`;
    const prev = wanted.get(key);
    const qty = num(g?.qtyNo ?? g?.quantity);
    wanted.set(key, { source, lotNo, qty: (prev?.qty ?? 0) + qty, name: String(g?.goodsName ?? lotNo) });
  }
  for (const w of wanted.values()) {
    const lots = await listAvailableLots(session, { source: w.source, q: w.lotNo, excludeOrderId: opts.excludeOrderId ?? null, limit: 200 });
    const lot = lots.find((l) => l.lotNo === w.lotNo);
    if (!lot) {
      throw new ApiClientError(`Stock lot ${w.lotNo} (${w.name}) is no longer available for this branch. Select the stock again.`, { status: 409, code: "STOCK_NOT_AVAILABLE" });
    }
    const balance = stockBalance({ availableQty: lot.remainingQty ?? lot.availableQty, requestedQty: w.qty });
    if (balance.over) {
      throw new ApiClientError(
        `Cannot sell ${w.qty} of ${w.name} (lot ${w.lotNo}): only ${balance.remaining} remain after other bookings.`,
        { status: 409, code: "STOCK_EXCEEDED" }
      );
    }
  }
}
