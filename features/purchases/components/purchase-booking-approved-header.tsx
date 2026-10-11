"use client";

import { useMemo, type ReactNode } from "react";
import { PurchaseApprovedHeader, type PapCountryRow, type PapStageRow } from "@/components/purchase-ui/purchase-approved-header";
import { countryLabel } from "@/lib/purchase-ui/country-name";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { fmtInt, fmtMoney, fmtPct, unitFor, valueIn } from "@/lib/purchase-ui/money-unit";

/**
 * Approved header for "Purchase Booking Details". The numbers come ONLY from the rows the page has already loaded (RBAC-scoped by the API)
 * and the page's own rate table; nothing is fetched, posted or invented here.
 *  - Confirmed  = booking already transferred / posted / completed
 *  - Pending    = accepted but not yet transferred
 *  - Draft      = everything else
 *  These three always add up to Total Records. Money follows unitFor() below: one currency -> shown as is; mixed -> USD only when the
 *  page's own rate table covers every currency used; otherwise "—" (never a guessed or double-converted number).
 */
type Report = Record<string, any>;
type Stage = "confirmed" | "pending" | "draft";

const low = (v: unknown) => String(v ?? "").toLowerCase();

export function bookingStage(r: Report): Stage {
  const posted =
    ["posted", "transferred", "completed"].includes(low(r.status)) ||
    ["posted", "transferred"].includes(low(r.ledgerPostingStatus)) || ["posted", "transferred"].includes(low(r.ledger_posting_status)) ||
    ["posted", "transferred"].includes(low(r.journalStatus)) || ["posted", "transferred"].includes(low(r.form_data?.workflow?.journalStatus)) ||
    r.is_transferred === true || r.form_data?.workflow?.is_transferred === true;
  if (posted) return "confirmed";
  if (low(r.status) === "accepted" || ["accepted", "confirmed"].includes(low(r.confirmationStatus))) return "pending";
  return "draft";
}

const amountOf = (r: Report) => Number(r.totalPurchaseAmount || r.purchaseAmount || 0);
const curOf = (r: Report) => String(r.currency || r.form_data?.form?.currencyType || "USD").toUpperCase();

export function BookingApprovedHeader({
  rows, usdRates, scopeCountry, toolbar, onCountryOpen,
}: {
  rows: Report[]; usdRates: Record<string, number>; scopeCountry?: string; toolbar: ReactNode; onCountryOpen?: (country: string) => void;
}) {
  const s = useErpScreen("pap");
  const m = useMemo(() => {
    const by: Record<Stage, Report[]> = { confirmed: [], pending: [], draft: [] };
    rows.forEach((r) => by[bookingStage(r)].push(r));
    const rateOf = (c: string) => usdRates[c];
    const unit = unitFor(rows, curOf, amountOf, rateOf);
    const total = valueIn(unit, rows, curOf, amountOf, rateOf);
    const confirmed = valueIn(unit, by.confirmed, curOf, amountOf, rateOf);
    const pending = valueIn(unit, [...by.pending, ...by.draft], curOf, amountOf, rateOf);
    const pct = fmtPct;
    const countryMap = new Map<string, Report[]>();
    rows.forEach((r) => { const k = String(r.countryName || "—"); (countryMap.get(k) ?? countryMap.set(k, []).get(k)!).push(r); });
    const countries = Array.from(countryMap.entries())
      .map(([name, list]) => { const u = unitFor(list, curOf, amountOf, rateOf); return { name, list, text: fmtMoney(u, valueIn(u, list, curOf, amountOf, rateOf)) }; })
      .sort((a, b) => b.list.length - a.list.length);
    return { by, unit, total, confirmed, pending, pct, countries };
  }, [rows, usdRates]);

  const only = m.countries.length === 1 && m.countries[0].name !== "—" ? m.countries[0].name : "";
  // a scoped user (one country) sees that country in the card titles, not "All Countries"
  const scope = (scopeCountry ? countryLabel(scopeCountry, s.t) : "") || (only ? countryLabel(only, s.t) : "") || s.t("allCountries", "All Countries");
  const orders = s.t("records", "Records");
  const stageRows: PapStageRow[] = [
    { key: "c", label: s.t("confirmed", "Confirmed"), value: fmtInt(m.by.confirmed.length), countLabel: orders, tone: "purple", valueTone: "blue" },
    { key: "p", label: s.t("pendingReview", "Pending Review"), value: fmtInt(m.by.pending.length), countLabel: orders, tone: "blue", valueTone: "blue" },
    { key: "d", label: s.t("draft", "Draft"), value: fmtInt(m.by.draft.length), countLabel: orders, tone: "red", valueTone: "red" },
    { key: "t", label: s.t("totalRecords", "Total Records"), value: fmtInt(rows.length), countLabel: orders, tone: "green", valueTone: "green" },
  ];
  const countryRows: PapCountryRow[] = m.countries.map((c) => ({
    key: c.name, name: countryLabel(c.name, s.t), value: c.text, count: fmtInt(c.list.length),
    onClick: onCountryOpen && c.name !== "—" ? () => onCountryOpen(c.name) : undefined,
  }));
  return (
    <PurchaseApprovedHeader
      page="booking-details"
      toolbar={toolbar}
      summary={{
        title: `${s.t("bookingSummary", "Booking Details Summary")} (${scope})`,
        subtitle: s.t("originalRegister", "Original ERP register"),
        metrics: [
          { label: s.t("totalBooking", "Total Booking Value"), value: fmtMoney(m.unit, m.total), note: m.unit.kind === "none" && rows.length > 0 ? s.t("mixedCurrencies", "Mixed currencies — no exchange rate") : `${fmtInt(rows.length)} ${orders}`, tone: "dark" },
          { label: s.t("confirmedValue", "Confirmed Value"), value: fmtMoney(m.unit, m.confirmed), note: m.pct(m.confirmed, m.total) && `${m.pct(m.confirmed, m.total)} ${s.t("confirmed", "Confirmed")}`, tone: "green" },
          { label: s.t("pendingValue", "Pending Value"), value: fmtMoney(m.unit, m.pending), note: m.pct(m.pending, m.total) && `${m.pct(m.pending, m.total)} ${s.t("pendingReview", "Pending Review")}`, tone: "red" },
        ],
      }}
      stages={{ title: `${s.t("bookingStatus", "Booking Status")} (${scope})`, subtitle: s.t("currentPeriod", "Current period"), rows: stageRows }}
      countries={{ title: `${s.t("countries", "Countries")} (${countryRows.length})`, subtitle: scope, rows: countryRows, emptyLabel: "—" }}
    />
  );
}
