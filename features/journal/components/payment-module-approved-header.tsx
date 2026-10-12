"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PurchaseApprovedHeader, type PapCountryRow, type PapStageRow } from "@/components/purchase-ui/purchase-approved-header";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { countryLabel } from "@/lib/purchase-ui/country-name";
import { fmtInt, fmtMoney, fmtPct, unitFor, valueIn } from "@/lib/purchase-ui/money-unit";

/**
 * Approved header (yellow summary · blue payment types · green countries) for the ten Journal payment pages:
 *   Purchase Payments — Advance, Endorsement, Credit, Remaining, Purchase Payment History, Final
 *   Sales Payments    — Advance / Receipt, Credit / Receipt, Remaining / Receipt, Sales Payment History
 *
 * PRESENTATION ONLY. The figures are plain sums of data the page already has (its RBAC-scoped order rows) and of the REAL payment records
 * from the read-only list APIs (/api/erp/purchases/payments, /api/erp/sales/payments). Nothing is posted, edited or converted here:
 * money follows lib/purchase-ui/money-unit (one currency as is; mixed → USD only when every currency has a rate; else "—").
 * Payment-type rows are links to the EXISTING routes — no new pages.
 */
export type PayModule = "purchase" | "sales";
export type ModuleRow = {
  id: string;
  country: string;
  currency: string;
  total: number;
  paid: number;
  due: number;
  settled: boolean;
  /** purchase only: the bill's payment condition is "endorsement" */
  endorsement?: boolean;
};
type ModulePayment = { orderId: string; kind: string; amount: number; currency: string };

const num = (v: unknown) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };

/** Real payment records of the module (posted entries; the system "booking" entry is not a user payment). `null` while loading / unavailable. */
export function useModulePayments(module: PayModule): ModulePayment[] | null {
  const [list, setList] = useState<ModulePayment[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const url = module === "purchase" ? "/api/erp/purchases/payments?limit=500" : "/api/erp/sales/payments?limit=500";
    void fetch(url, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.ok) return;
        const raw: any[] = j.data?.payments ?? [];
        setList(
          raw
            .filter((p) => String(p.status ?? "posted").toLowerCase() === "posted")
            .map((p) => module === "purchase"
              ? { orderId: String(p.purchase_order_id ?? p.local_purchase_id ?? ""), kind: String(p.kind ?? ""), amount: num(p.amount), currency: String(p.currency_code ?? "USD").toUpperCase() }
              : { orderId: String(p.sales_order_id ?? ""), kind: String(p.payment_kind ?? ""), amount: num(p.amount), currency: String(p.currency_code ?? "USD").toUpperCase() })
        );
      })
      .catch(() => { /* leave null → the payment-type amounts show "—" */ });
    return () => { cancelled = true; };
  }, [module]);
  return list;
}

type TypeDef = { key: string; labelEn: string; route: string; pick: (p: ModulePayment, ctx: { endorsement: Set<string>; settled: Set<string> }) => boolean; tone: PapStageRow["tone"]; valueTone: PapStageRow["valueTone"] };

const PURCHASE_TYPES: TypeDef[] = [
  { key: "advance", labelEn: "Advance Payment", route: "/dashboard/journal/purchase-order-payment/advance", pick: (p) => p.kind === "advance", tone: "purple", valueTone: "blue" },
  { key: "endorsement", labelEn: "Endorsement Payment", route: "/dashboard/journal/purchase-order-payment/endorsement", pick: (p, c) => p.kind === "advance" && c.endorsement.has(p.orderId), tone: "blue", valueTone: "blue" },
  { key: "credit", labelEn: "Credit Payment", route: "/dashboard/journal/purchase-order-payment/charges", pick: (p) => p.kind === "credit", tone: "red", valueTone: "red" },
  { key: "remaining", labelEn: "Remaining Payment", route: "/dashboard/journal/purchase-order-payment/remaining", pick: (p) => p.kind === "remaining", tone: "green", valueTone: "green" },
  { key: "history", labelEn: "Purchase Payment History", route: "/dashboard/journal/purchase-order-payment/history", pick: () => true, tone: "purple", valueTone: "blue" },
  { key: "final", labelEn: "Final Payment", route: "/dashboard/journal/purchase-order-payment/final", pick: (p, c) => c.settled.has(p.orderId), tone: "green", valueTone: "green" },
];
const SALES_TYPES: TypeDef[] = [
  { key: "advance", labelEn: "Advance Payment / Receipt", route: "/dashboard/journal/sales-order-payment/advance", pick: (p) => p.kind === "advance", tone: "purple", valueTone: "blue" },
  { key: "credit", labelEn: "Credit Payment / Receipt", route: "/dashboard/journal/sales-order-payment/charges", pick: (p) => p.kind === "credit", tone: "blue", valueTone: "blue" },
  { key: "remaining", labelEn: "Remaining Payment / Recovery", route: "/dashboard/journal/sales-order-payment/remaining", pick: (p) => p.kind === "remaining", tone: "red", valueTone: "red" },
  { key: "history", labelEn: "Sales Payment History", route: "/dashboard/journal/sales-order-payment/history", pick: () => true, tone: "green", valueTone: "green" },
];

export function PaymentModuleHeader({
  module, title, activeKey, rows, payments, rates, scopeCountry, toolbar, onCountryOpen, translateLabel,
}: {
  module: PayModule;
  /** page title, already translated */
  title: string;
  /** which of the module's pages is open (used only to mark it) */
  activeKey?: string;
  rows: readonly ModuleRow[];
  payments: ModulePayment[] | null;
  rates?: Record<string, number>;
  scopeCountry?: string;
  toolbar: ReactNode;
  onCountryOpen?: (country: string) => void;
  /** translates a menu/page label with the ERP's existing header/menu dictionary (the same words as the sidebar) */
  translateLabel: (label: string) => string;
}) {
  const s = useErpScreen("pap");
  const router = useRouter();
  const types = module === "purchase" ? PURCHASE_TYPES : SALES_TYPES;

  const m = useMemo(() => {
    const rateOf = (c: string) => rates?.[c];
    const unit = unitFor(rows, (r) => r.currency, (r) => r.total || r.paid || r.due, rateOf);
    const sum = (list: readonly ModuleRow[], pick: (r: ModuleRow) => number) => valueIn(unit, list, (r) => r.currency, pick, rateOf);
    const total = sum(rows, (r) => r.total);
    const paid = sum(rows, (r) => r.paid);
    const due = sum(rows, (r) => r.due);

    const ctx = {
      endorsement: new Set(rows.filter((r) => r.endorsement).map((r) => r.id)),
      settled: new Set(rows.filter((r) => r.settled).map((r) => r.id)),
    };
    const visible = new Set(rows.map((r) => r.id));
    const mine = (payments ?? []).filter((p) => !p.orderId || visible.has(p.orderId));
    const pUnit = unitFor(mine, (p) => p.currency, (p) => p.amount, rateOf);
    const typeTotals = types.map((t) => {
      const list = mine.filter((p) => t.pick(p, ctx));
      return { def: t, count: list.length, value: payments === null ? null : valueIn(pUnit, list, (p) => p.currency, (p) => p.amount, rateOf) };
    });

    const byCountry = new Map<string, ModuleRow[]>();
    rows.forEach((r) => { (byCountry.get(r.country) ?? byCountry.set(r.country, []).get(r.country)!).push(r); });
    const countries = Array.from(byCountry.entries()).map(([name, list]) => {
      const u = unitFor(list, (r) => r.currency, (r) => r.total || r.paid || r.due, rateOf);
      return { name, count: list.length, text: fmtMoney(u, valueIn(u, list, (r) => r.currency, (r) => r.total, rateOf)) };
    }).sort((a, b) => b.count - a.count);
    return { unit, total, paid, due, pUnit, typeTotals, countries };
  }, [rows, payments, rates, types]);

  const scope = (scopeCountry ? countryLabel(scopeCountry, s.t) : "") ||
    (m.countries.length === 1 && m.countries[0].name !== "—" ? countryLabel(m.countries[0].name, s.t) : "") || s.t("allCountries", "All Countries");
  const f = (v: number | null) => fmtMoney(m.unit, v);
  const isPurchase = module === "purchase";
  const note = m.unit.kind === "none" && rows.length > 0 ? s.t("mixedCurrencies", "Mixed currencies — no exchange rate") : `${fmtInt(rows.length)} ${s.t("records", "Records")}`;

  const stageRows: PapStageRow[] = m.typeTotals.map(({ def, count, value }) => ({
    key: def.key,
    label: translateLabel(def.labelEn),
    value: fmtMoney(m.pUnit, value),
    count: fmtInt(count),
    tone: def.tone,
    valueTone: def.valueTone,
    onClick: def.key === activeKey ? undefined : () => router.push(def.route),
  }));
  const countryRows: PapCountryRow[] = m.countries.map((c) => ({
    key: c.name, name: /^unknown country$/i.test(c.name) ? translateLabel("Unknown Country") : countryLabel(c.name, s.t), value: c.text, count: fmtInt(c.count),
    onClick: onCountryOpen && c.name !== "—" ? () => onCountryOpen(c.name) : undefined,
  }));

  return (
    <PurchaseApprovedHeader
      page="payment-module"
      title={title}
      crumbModule={isPurchase ? s.t("purchase", "Purchase") : s.t("sales", "Sales")}
      toolbar={toolbar}
      summary={{
        title: `${isPurchase ? s.t("paymentSummary", "Purchase Summary") : s.t("salesSummary", "Sales Summary")} (${scope})`,
        subtitle: s.t("currentPeriod", "Current period"),
        metrics: [
          { label: isPurchase ? s.t("totalPurchaseBills", "Total Purchase Bills") : s.t("totalSalesBills", "Total Sales Bills"), value: f(m.total), note, tone: "dark" },
          { label: isPurchase ? s.t("totalPaid", "Total Paid Payments") : s.t("totalReceived", "Total Received"), value: f(m.paid), note: fmtPct(m.paid, m.total) ? `${fmtPct(m.paid, m.total)} ${s.t("paid", "Paid Payment")}` : undefined, tone: "green" },
          { label: isPurchase ? s.t("remainingBalance", "Remaining Balance") : s.t("receivableBalance", "Receivable Balance"), value: f(m.due), note: fmtPct(m.due, m.total) ? `${fmtPct(m.due, m.total)} ${s.t("outstanding", "Outstanding")}` : undefined, tone: "red" },
        ],
      }}
      stages={{ title: `${s.t("paymentType", "Payment Type")} (${scope})`, subtitle: s.t("currentPeriod", "Current period"), rows: stageRows }}
      countries={{ title: `${s.t("countries", "Countries")} (${countryRows.length})`, subtitle: scope, rows: countryRows, emptyLabel: "—" }}
    />
  );
}

/** Module rows from the Purchase order rows the Journal pages already load (same fields the journal's own table reads). */
export function purchaseOrdersToModuleRows(orders: readonly any[]): ModuleRow[] {
  return orders.map((o) => {
    const total = num(o.order_total);
    const paid = num(o.advance_paid) + num(o.remaining_paid) + num(o.credit_amount);
    const due = o.remaining_due === null || o.remaining_due === undefined ? Math.max(0, total - paid) : Math.max(0, num(o.remaining_due));
    const status = String(o.payment_status || "").toLowerCase();
    const form = o.form_data?.form || {};
    return {
      id: String(o.id),
      country: String(o.countryName || o.country_name || o.countries?.name || "—"),
      currency: String(o.currency_code || o.purchase_currency || "USD").toUpperCase(),
      total, paid, due,
      settled: status === "paid" || status === "completed" || (total > 0 && due <= 0.01),
      endorsement: String(form.paymentType || form.paymentCondition || "").toLowerCase().includes("endorsement"),
    };
  });
}
