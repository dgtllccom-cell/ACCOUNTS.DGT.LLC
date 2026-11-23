import { resolveBookingRate } from "@/lib/sales/sales-goods-model";

type BookingCurrencyFields = {
  purchaseCurrency?: string;
  goodsPurchaseCurrency?: string;
  salesCurrency?: string;
  currencyType?: string;
  secondaryCurrency?: string;
  exchangeRate?: number | string;
  operator?: string;
};

export function getBookingCurrencies(form: BookingCurrencyFields) {
  const sales = form.salesCurrency || form.currencyType || "";
  const final = form.secondaryCurrency || sales;
  const purchase = form.purchaseCurrency || form.currencyType || sales;
  const rate = resolveBookingRate({
    invoiceCurrency: sales,
    settlementCurrency: final,
    exchangeRate: Number(form.exchangeRate),
    operator: form.operator === "/" ? "/" : "*",
  });
  return { sales, final, purchase, rate };
}

export function convertedSalesAmount(amount: number, rate: ReturnType<typeof getBookingCurrencies>["rate"]) {
  if (!rate.ok) return null;
  return rate.operator === "/" ? amount / rate.rate : amount * rate.rate;
}
