/**
 * Pure calculations for the Endorsement / Advance / Remaining payment entry document
 * (features/journal/components/purchase-payment-entry-document.tsx).
 *
 * Nothing here posts or stores anything: it only derives what the screen shows from the order and its payment rows, using the SAME rules the
 * payment API enforces (app/api/erp/purchases/orders/[id]/payments/route.ts):
 *   - the amount a user types is converted to the PURCHASE currency exactly like the server does, and
 *   - an advance / remaining / credit payment may never exceed the remaining payable balance (0.01 tolerance).
 */

import { translateCountry } from "@/lib/i18n/table-values";

export type PaymentEntryMode = "endorsement" | "advance" | "remaining";

export const PAYMENT_LIMIT_TOLERANCE = 0.01;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** The endorsement / advance percentage of an order — same precedence as the payment API. */
export function orderPaymentPercent(form: Record<string, unknown> | null | undefined): number {
  const f = form ?? {};
  return num(f.endorsementPercent ?? f.endorsement_percent) || num(f.advancePercent ?? f.advance_percent);
}

/** An order is an "endorsement order" when its payment type / condition says so (same test as the module header's type filter). */
export function isEndorsementOrder(form: Record<string, unknown> | null | undefined): boolean {
  const f = form ?? {};
  return String(f.paymentType ?? f.paymentCondition ?? "").toLowerCase().includes("endorsement");
}

/**
 * The typed payment amount expressed in the order's PURCHASE currency — a line-for-line mirror of the server's `bodyAmountPur`:
 * same currency → as typed; entered in the branch's LOCAL currency → divide by the rate (the client's rate is only honoured within ±10% of
 * the order's own rate); any other currency → amount × rate ÷ order rate.
 */
export function amountInPurchaseCurrency(input: {
  amount: number;
  paymentCurrency: string;
  rate: number;
  purchaseCurrency: string;
  localCurrency: string;
  orderRate: number;
}): number {
  const amount = num(input.amount);
  const payCcy = String(input.paymentCurrency || "").toUpperCase();
  const orderCcy = String(input.purchaseCurrency || "").toUpperCase();
  const localCcy = String(input.localCurrency || "").toUpperCase();
  const orderRate = num(input.orderRate) > 0 ? num(input.orderRate) : 1;
  const rate = num(input.rate);
  if (!payCcy || payCcy === orderCcy) return amount;
  if (localCcy && payCcy === localCcy) {
    const usable = rate > 0 && Math.abs(rate / orderRate - 1) <= 0.1 ? rate : orderRate;
    return amount / usable;
  }
  const bodyRate = rate > 0 ? rate : 1;
  return (amount * bodyRate) / orderRate;
}

export type PaymentLimit = {
  /** the most that may still be paid, in the purchase currency */
  maxPayable: number;
  entered: number;
  over: boolean;
  /** how far over the limit the entered amount is (0 when within it) */
  excess: number;
  /** entered amount as a share of the whole contract, in % */
  enteredPercentOfContract: number;
};

/** An entry may use the whole remaining balance — up to 100% of the contract on a fresh order — but never more. */
export function checkPaymentLimit(input: { entered: number; balance: number; contractTotal: number }): PaymentLimit {
  const maxPayable = Math.max(0, num(input.balance));
  const entered = Math.max(0, num(input.entered));
  const over = entered > maxPayable + PAYMENT_LIMIT_TOLERANCE;
  return {
    maxPayable: round2(maxPayable),
    entered: round2(entered),
    over,
    excess: over ? round2(entered - maxPayable) : 0,
    enteredPercentOfContract: num(input.contractTotal) > 0 ? round2((entered / num(input.contractTotal)) * 100) : 0
  };
}

export type EntryGoodsInput = {
  name: string;
  hsCode: string;
  qty: number;
  netKg: number;
  /** purchase-currency amount of the line */
  amount: number;
  /** local-currency amount of the line (0 when unknown → derived from the order rate) */
  finalAmount: number;
};

export type EntryPaymentInput = {
  id: string;
  kind: string;
  /** amount in the PURCHASE currency */
  amountPurchase: number;
  /** amount in the LOCAL currency */
  amountLocal: number;
  date: string;
};

export type EntryModelInput = {
  mode: PaymentEntryMode;
  /** contract total in the purchase currency / in the local currency */
  contractTotal: number;
  contractTotalLocal: number;
  /** the order's own exchange rate (purchase → local) */
  rate: number;
  percent: number;
  endorsementOrder: boolean;
  goods: EntryGoodsInput[];
  payments: EntryPaymentInput[];
  /** the screen's existing figures for "paid so far" / "still to pay" (they also cover the loading-batch case) */
  totalPaid: number;
  balance: number;
};

export type EntryGoodsLine = EntryGoodsInput & {
  rate: number;
  /** the share of this line the current stage covers (endorsement/advance: line × %; remaining: line × balance ÷ contract) */
  stageAmount: number;
  stageFinal: number;
};

export type EntryModel = {
  /** what the stage requires: endorsement/advance = contract × %, remaining = the balance still to pay */
  requiredAmount: number;
  requiredLocal: number;
  stagePercent: number;
  endorsementPaid: number;
  advancePaid: number;
  remainingPaid: number;
  creditPaid: number;
  totalPaid: number;
  totalPaidLocal: number;
  balance: number;
  balanceLocal: number;
  paidPercent: number;
  stillRequired: number;
  goods: EntryGoodsLine[];
  goodsTotals: { qty: number; netKg: number; amount: number; finalAmount: number; stageAmount: number; stageFinal: number };
  /** per advance-kind payment: how much of it went to the endorsement requirement and how much was a plain advance */
  allocations: Record<string, { endorsement: number; advance: number }>;
  status: "draft" | "partial" | "paid";
};

export function buildPaymentEntryModel(input: EntryModelInput): EntryModel {
  const total = Math.max(0, num(input.contractTotal));
  const rate = num(input.rate) > 0 ? num(input.rate) : 1;
  const totalLocal = num(input.contractTotalLocal) > 0 ? num(input.contractTotalLocal) : total * rate;
  const balance = Math.max(0, num(input.balance));
  const totalPaid = Math.max(0, num(input.totalPaid));
  const percent = Math.max(0, num(input.percent));

  // advance-kind payments fill the endorsement requirement first (oldest first), the rest are plain advances
  const required = round2((total * percent) / 100);
  let endorsementLeft = input.endorsementOrder ? required : 0;
  let endorsementPaid = 0;
  let advancePaid = 0;
  let remainingPaid = 0;
  let creditPaid = 0;
  const chronological = [...input.payments].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const allocations: EntryModel["allocations"] = {};
  for (const p of chronological) {
    const v = Math.max(0, num(p.amountPurchase));
    if (p.kind === "remaining") remainingPaid += v;
    else if (p.kind === "credit") creditPaid += v;
    else if (p.kind === "advance") {
      const toEndorsement = Math.min(endorsementLeft, v);
      endorsementPaid += toEndorsement;
      endorsementLeft -= toEndorsement;
      advancePaid += v - toEndorsement;
      allocations[p.id] = { endorsement: round2(toEndorsement), advance: round2(v - toEndorsement) };
    }
  }

  const stageIsRemaining = input.mode === "remaining";
  const stagePercent = stageIsRemaining ? (total > 0 ? (balance / total) * 100 : 0) : percent;
  const requiredAmount = stageIsRemaining ? round2(balance) : required;

  const goods: EntryGoodsLine[] = input.goods.map((g) => {
    const lineRate = g.finalAmount > 0 && g.amount > 0 ? g.finalAmount / g.amount : rate;
    const finalAmount = g.finalAmount > 0 ? g.finalAmount : g.amount * rate;
    const share = stageIsRemaining ? (total > 0 ? balance / total : 0) : percent / 100;
    return { ...g, finalAmount, rate: lineRate, stageAmount: round2(g.amount * share), stageFinal: round2(finalAmount * share) };
  });
  const sum = (pick: (g: EntryGoodsLine) => number) => round2(goods.reduce((s, g) => s + pick(g), 0));

  const status: EntryModel["status"] = balance <= PAYMENT_LIMIT_TOLERANCE && total > 0 ? "paid" : totalPaid > PAYMENT_LIMIT_TOLERANCE ? "partial" : "draft";

  return {
    requiredAmount,
    requiredLocal: round2(requiredAmount * rate),
    stagePercent: round2(stagePercent),
    endorsementPaid: round2(endorsementPaid),
    advancePaid: round2(advancePaid),
    remainingPaid: round2(remainingPaid),
    creditPaid: round2(creditPaid),
    totalPaid: round2(totalPaid),
    totalPaidLocal: round2(totalPaid * rate),
    balance: round2(balance),
    balanceLocal: round2(balance * rate),
    paidPercent: total > 0 ? round2((totalPaid / total) * 100) : 0,
    stillRequired: input.endorsementOrder ? round2(Math.max(0, required - endorsementPaid)) : round2(Math.max(0, required - advancePaid)),
    goods,
    goodsTotals: {
      qty: sum((g) => g.qty),
      netKg: sum((g) => g.netKg),
      amount: sum((g) => g.amount),
      finalAmount: sum((g) => g.finalAmount),
      stageAmount: sum((g) => g.stageAmount),
      stageFinal: sum((g) => g.stageFinal)
    },
    allocations,
    status
  };
}

/**
 * Local (office) currency of an order's country. The country NAME on an order row is localized by the API (Urdu / Arabic / Farsi / Pashto),
 * and matching English text only made every non-English user fall through to "USD" — which silently mis-converted every local-currency
 * figure on the payment pages. The translated names of the supported office countries are recognised too.
 */
const OFFICE_COUNTRIES: Array<{ english: string; code: string; aliases: string[] }> = [
  { english: "Pakistan", code: "PKR", aliases: ["PAKISTAN"] },
  { english: "United Arab Emirates", code: "AED", aliases: ["EMIRATES", "UAE", "DUBAI"] },
  { english: "China", code: "CNY", aliases: ["CHINA"] },
  { english: "India", code: "INR", aliases: ["INDIA"] },
  { english: "Afghanistan", code: "AFN", aliases: ["AFGHANISTAN"] }
];
let translatedOfficeNames: Map<string, string> | null = null;

export function officeCurrencyForCountryName(name: string | null | undefined): string {
  const raw = String(name ?? "").trim();
  const upper = raw.toUpperCase();
  for (const c of OFFICE_COUNTRIES) if (c.aliases.some((a) => upper.includes(a))) return c.code;
  if (!translatedOfficeNames) {
    translatedOfficeNames = new Map();
    for (const c of OFFICE_COUNTRIES) {
      for (const lang of ["ur", "ar", "fa", "ps"]) {
        const v = translateCountry(c.english, lang).trim();
        if (v && v !== c.english) translatedOfficeNames.set(v, c.code);
      }
    }
  }
  return translatedOfficeNames.get(raw) ?? "USD";
}
