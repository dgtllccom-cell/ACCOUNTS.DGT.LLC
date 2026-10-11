"use client";

import { useMemo, type ReactNode } from "react";
import { PurchaseApprovedHeader, type ApprovedPurchasePage, type PapCountryRow, type PapStageRow } from "@/components/purchase-ui/purchase-approved-header";
import { countryLabel } from "@/lib/purchase-ui/country-name";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { fmtInt, fmtMoney, fmtPct, unitFor, valueIn } from "@/lib/purchase-ui/money-unit";

/**
 * Approved header for the three payment-type pages: Purchase Payments, Purchase Orders Payment, Country Bill Payment.
 * The figures are plain sums of fields the page's own API rows already carry (order total, advance paid, remaining paid, credit,
 * remaining due). Nothing is posted, fetched or converted here; money follows unitFor() (one currency as-is, mixed -> USD only
 * when every currency has a rate, otherwise "—"), and a missing figure is "—", never a made-up zero.
 */
export type PayRow = { country: string; currency: string; total: number; advance: number; remainingPaid: number; credit: number; due: number; settled: boolean };
export type PaymentVariant = "payments" | "orders" | "country-bill";

const n = (v: unknown) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };

/** rows of GET /api/erp/purchases/orders (and the journal's `orders` prop) */
export function ordersToPayRows(orders: readonly any[]): PayRow[] {
  return orders.map((o) => {
    const total = n(o.order_total);
    const advance = n(o.advance_paid);
    const remainingPaid = n(o.remaining_paid);
    const credit = n(o.credit_amount);
    const due = o.remaining_due === null || o.remaining_due === undefined ? Math.max(0, total - advance - remainingPaid - credit) : Math.max(0, n(o.remaining_due));
    return {
      country: String(o.countryName || o.country_name || o.countries?.name || "—"),
      currency: String(o.currency_code || o.purchase_currency || "USD").toUpperCase(),
      total, advance, remainingPaid, credit, due,
      settled: o.payment_status === "completed" || due <= 0.01,
    };
  });
}

/** rows of GET /api/erp/purchases/booking-journal-report (Purchase Order Management dashboard) */
export function reportsToPayRows(reports: readonly any[]): PayRow[] {
  return reports.map((r) => {
    const total = n(r.totalPurchaseAmount || r.purchaseAmount);
    const advance = n(r.advancePaid ?? r.advance_paid ?? r.advanceAmount);
    const remainingPaid = n(r.remaining_paid ?? r.remainingPaid);
    const credit = n(r.credit_amount ?? r.creditAmount);
    const hasDue = [r.remaining_due, r.remainingDue, r.remainingBalance].find((v) => v !== null && v !== undefined && !Number.isNaN(Number(v)));
    const due = hasDue !== undefined ? Math.max(0, n(hasDue)) : Math.max(0, total - advance - remainingPaid - credit);
    return {
      country: String(r.countryName || "—"),
      currency: String(r.currency || r.form_data?.form?.currencyType || "USD").toUpperCase(),
      total, advance, remainingPaid, credit, due,
      settled: due <= 0.01 && total > 0,
    };
  });
}

const PAGE: Record<PaymentVariant, ApprovedPurchasePage> = { payments: "purchase-payments", orders: "orders-payment", "country-bill": "country-bill-payment" };
const paidOf = (r: PayRow) => r.advance + r.remainingPaid + r.credit;

export function PaymentApprovedHeader({
  variant, rows, rates, scopeCountry, toolbar, onCountryOpen,
}: {
  variant: PaymentVariant; rows: PayRow[]; rates?: Record<string, number>; scopeCountry?: string; toolbar: ReactNode; onCountryOpen?: (country: string) => void;
}) {
  const s = useErpScreen("pap");
  const m = useMemo(() => {
    const rateOf = (c: string) => rates?.[c];
    const cur = (r: PayRow) => r.currency;
    const unit = unitFor(rows, cur, (r) => r.total || paidOf(r) || r.due, rateOf);
    const sum = (list: PayRow[], pick: (r: PayRow) => number) => valueIn(unit, list, cur, pick, rateOf);
    const cnt = (list: PayRow[], pick: (r: PayRow) => number) => list.filter((r) => pick(r) > 0).length;
    const total = sum(rows, (r) => r.total);
    const paid = sum(rows, paidOf);
    const due = sum(rows, (r) => r.due);
    const settledRows = rows.filter((r) => r.settled);
    const stage = {
      advance: { v: sum(rows, (r) => r.advance), c: cnt(rows, (r) => r.advance) },
      remainingPaid: { v: sum(rows, (r) => r.remainingPaid), c: cnt(rows, (r) => r.remainingPaid) },
      credit: { v: sum(rows, (r) => r.credit), c: cnt(rows, (r) => r.credit) },
      due: { v: due, c: cnt(rows, (r) => r.due) },
      paid: { v: paid, c: cnt(rows, paidOf) },
      final: { v: sum(settledRows, paidOf), c: cnt(settledRows, paidOf) },
    };
    const byCountry = new Map<string, PayRow[]>();
    rows.forEach((r) => { (byCountry.get(r.country) ?? byCountry.set(r.country, []).get(r.country)!).push(r); });
    const countries = Array.from(byCountry.entries()).map(([name, list]) => {
      const u = unitFor(list, cur, (r) => r.total || paidOf(r) || r.due, rateOf);
      return { name, count: list.length, text: fmtMoney(u, valueIn(u, list, cur, (r) => r.total, rateOf)) };
    }).sort((a, b) => b.count - a.count);
    return { unit, total, paid, due, stage, countries };
  }, [rows, rates]);

  const only = m.countries.length === 1 && m.countries[0].name !== "—" ? m.countries[0].name : "";
  // a scoped user (one country) sees that country in the card titles, not "All Countries"
  const scope = (scopeCountry ? countryLabel(scopeCountry, s.t) : "") || (only ? countryLabel(only, s.t) : "") || s.t("allCountries", "All Countries");
  const f = (v: number | null) => fmtMoney(m.unit, v);
  const noteTotal = m.unit.kind === "none" && rows.length > 0 ? s.t("mixedCurrencies", "Mixed currencies — no exchange rate") : `${fmtInt(rows.length)} ${s.t("records", "Records")}`;
  const stageRow = (key: string, label: string, st: { v: number | null; c: number }, tone: PapStageRow["tone"], valueTone?: PapStageRow["valueTone"]): PapStageRow =>
    ({ key, label, value: f(st.v), count: fmtInt(st.c), tone, valueTone });

  const cfg = {
    payments: {
      summary: s.t("paymentSummary", "Purchase Summary"), labels: [s.t("totalPurchaseBills", "Total Purchase Bills"), s.t("totalPaid", "Total Paid Payments"), s.t("remainingBalance", "Remaining Balance")],
      stageTitle: s.t("paymentType", "Payment Type"),
      stages: [stageRow("a", s.t("invoicePayment", "Invoice Payment"), m.stage.advance, "purple", "blue"), stageRow("b", s.t("remaining", "Remaining"), m.stage.due, "blue", "blue"),
               stageRow("c", s.t("credit", "Credit"), m.stage.credit, "red", "red"), stageRow("d", s.t("paid", "Paid Payment"), m.stage.paid, "green", "green")],
    },
    orders: {
      summary: s.t("orderSummary", "Order Payment Summary"), labels: [s.t("totalOrderAmount", "Total Order Amount"), s.t("totalPayments", "Total Payments"), s.t("outstanding", "Outstanding")],
      stageTitle: s.t("paymentStages", "Payment Stages"),
      stages: [stageRow("a", s.t("advancePayment", "Advance Payment"), m.stage.advance, "purple", "blue"), stageRow("b", s.t("remainingPayment", "Remaining Payment"), m.stage.remainingPaid, "blue", "blue"),
               stageRow("c", s.t("creditPayment", "Credit Payment"), m.stage.credit, "red", "red"), stageRow("d", s.t("finalPayment", "Final Payment"), m.stage.final, "green", "green")],
    },
    "country-bill": {
      summary: s.t("billSummary", "Country Bill Summary"), labels: [s.t("totalCountryBills", "Total Country Bills"), s.t("paidBillAmount", "Paid Bill Amount"), s.t("remainingBills", "Remaining Bills")],
      stageTitle: s.t("billPaymentType", "Bill Payment Type"),
      stages: [stageRow("a", s.t("invoicePayments", "Invoice Payments"), m.stage.advance, "purple", "blue"), stageRow("b", s.t("remainingPayments", "Remaining Payments"), m.stage.remainingPaid, "blue", "blue"),
               stageRow("c", s.t("creditPayments", "Credit Payments"), m.stage.credit, "red", "red"), stageRow("d", s.t("totalPaidBills", "Total Paid"), m.stage.paid, "green", "green")],
    },
  }[variant];

  const countryRows: PapCountryRow[] = m.countries.map((c) => ({
    key: c.name, name: countryLabel(c.name, s.t), value: c.text, count: fmtInt(c.count),
    onClick: onCountryOpen && c.name !== "—" ? () => onCountryOpen(c.name) : undefined,
  }));

  return (
    <PurchaseApprovedHeader
      page={PAGE[variant]}
      toolbar={toolbar}
      summary={{
        title: `${cfg.summary} (${scope})`,
        subtitle: s.t("currentPeriod", "Current period"),
        metrics: [
          { label: cfg.labels[0], value: f(m.total), note: noteTotal, tone: "dark" },
          { label: cfg.labels[1], value: f(m.paid), note: fmtPct(m.paid, m.total) ? `${fmtPct(m.paid, m.total)} ${s.t("paid", "Paid Payment")}` : undefined, tone: "green" },
          { label: cfg.labels[2], value: f(m.due), note: fmtPct(m.due, m.total) ? `${fmtPct(m.due, m.total)} ${s.t("outstanding", "Outstanding")}` : undefined, tone: "red" },
        ],
      }}
      stages={{ title: `${cfg.stageTitle} (${scope})`, subtitle: s.t("currentPeriod", "Current period"), rows: cfg.stages }}
      countries={{ title: `${s.t("countries", "Countries")} (${countryRows.length})`, subtitle: scope, rows: countryRows, emptyLabel: "—" }}
    />
  );
}
