"use client";

import { useMemo, type ReactNode } from "react";
import { PurchaseApprovedHeader, type PapCountryRow, type PapStageRow } from "@/components/purchase-ui/purchase-approved-header";
import { countryLabel } from "@/lib/purchase-ui/country-name";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { fmtInt, fmtPct } from "@/lib/purchase-ui/money-unit";

/**
 * Approved header for "Purchase Loading Records". Quantities and record counts are the page's OWN already-computed numbers
 * (loadingSummaryRows = booked / loaded quantity per country from the contracts; records = the loading records in scope).
 * Quantities are plain sums in the unit the page already uses (bags); nothing is converted, posted or invented.
 */
type SummaryRow = { country: string; totalQuantity: number; loadedQuantity: number; totalPOs: Set<string> };
type LoadingRec = { loading_status?: string | null; [k: string]: any };

const stageOf = (status: unknown): "loaded" | "transit" | "delivered" | "pending" | null => {
  const s = String(status ?? "").toLowerCase();
  if (s === "loaded") return "loaded";
  if (s === "dispatched" || s === "in_transit") return "transit";
  if (s === "received" || s === "partially_received") return "delivered";
  if (s === "pending" || s === "draft") return "pending";
  return null; // cancelled / unknown: not part of the four loading stages
};

export function LoadingApprovedHeader({
  summaryRows, records, toolbar, unitLabel, scopeCountry, onCountryOpen,
}: {
  summaryRows: readonly SummaryRow[]; records: readonly LoadingRec[]; toolbar: ReactNode; unitLabel: string; scopeCountry?: string; onCountryOpen?: (country: string) => void;
}) {
  const s = useErpScreen("pap");
  const m = useMemo(() => {
    const booked = summaryRows.reduce((a, r) => a + r.totalQuantity, 0);
    const loaded = summaryRows.reduce((a, r) => a + r.loadedQuantity, 0);
    const left = Math.max(0, booked - loaded);
    const pos = new Set<string>();
    summaryRows.forEach((r) => r.totalPOs.forEach((p) => pos.add(p)));
    const count = { loaded: 0, transit: 0, delivered: 0, pending: 0 };
    records.forEach((r) => { const st = stageOf(r.loading_status); if (st) count[st] += 1; });
    return { booked, loaded, left, bookings: pos.size, count, hasData: summaryRows.length > 0 };
  }, [summaryRows, records]);

  const only = summaryRows.length === 1 && summaryRows[0].country ? summaryRows[0].country : "";
  // a scoped user (one country) sees that country in the card titles, not "All Countries"
  const scope = (scopeCountry ? countryLabel(scopeCountry, s.t) : "") || (only ? countryLabel(only, s.t) : "") || s.t("allCountries", "All Countries");
  const q = (n: number) => (m.hasData ? `${fmtInt(n)} ${unitLabel}` : "—");
  const rec = s.t("records", "Records");
  const stageRows: PapStageRow[] = [
    { key: "l", label: s.t("loaded", "Loaded"), value: fmtInt(m.count.loaded), countLabel: rec, tone: "purple", valueTone: "blue" },
    { key: "t", label: s.t("inTransit", "In Transit"), value: fmtInt(m.count.transit), countLabel: rec, tone: "blue", valueTone: "blue" },
    { key: "d", label: s.t("delivered", "Delivered"), value: fmtInt(m.count.delivered), countLabel: rec, tone: "red", valueTone: "red" },
    { key: "p", label: s.t("pendingLoad", "Pending Load"), value: fmtInt(m.count.pending), countLabel: rec, tone: "green", valueTone: "green" },
  ];
  const countryRows: PapCountryRow[] = [...summaryRows]
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .map((r) => ({
      key: r.country, name: countryLabel(r.country, s.t), value: `${fmtInt(r.totalQuantity)} ${unitLabel}`, count: fmtInt(r.totalPOs.size),
      onClick: onCountryOpen ? () => onCountryOpen(r.country) : undefined,
    }));

  return (
    <PurchaseApprovedHeader
      page="loading-records"
      title={s.t("loadingBooking", "Loading Booking")}
      toolbar={toolbar}
      summary={{
        title: `${s.t("loadingSummary", "Loading Summary")} (${scope})`,
        subtitle: unitLabel,
        metrics: [
          { label: s.t("bookedQuantity", "Booked Quantity"), value: q(m.booked), note: m.hasData ? `${fmtInt(m.bookings)} ${s.t("records", "Records")}` : undefined, tone: "dark" },
          { label: s.t("loadedQuantity", "Loaded Quantity"), value: q(m.loaded), note: fmtPct(m.loaded, m.booked) && `${fmtPct(m.loaded, m.booked)} ${s.t("loaded", "Loaded")}`, tone: "green" },
          { label: s.t("leftToLoad", "Left to Load"), value: q(m.left), note: fmtPct(m.left, m.booked) && `${fmtPct(m.left, m.booked)} ${s.t("pendingLoad", "Pending Load")}`, tone: "red" },
        ],
      }}
      stages={{ title: `${s.t("loadingStatus", "Loading Status")} (${scope})`, subtitle: s.t("currentPeriod", "Current period"), rows: stageRows }}
      countries={{ title: `${s.t("countries", "Countries")} (${countryRows.length})`, subtitle: scope, rows: countryRows, emptyLabel: "—" }}
    />
  );
}
