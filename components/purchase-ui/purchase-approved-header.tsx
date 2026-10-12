"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronRight, FileText, Filter, Globe2, Layers, MoreVertical, RefreshCw, Search, ShoppingCart } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { cn } from "@/lib/utils";
import "./purchase-approved.css";

/**
 * The owner-approved header for the FIVE Purchase pages (Booking Details, Purchase Payments, Purchase Orders Payment,
 * Country Bill Payment, Purchase Loading Records): icon + title + breadcrumb + page toolbar, then the three approved cards
 * (yellow summary · blue status list · green countries list).
 *
 * PRESENTATION ONLY. Every number/label is passed in already computed by the page's EXISTING data code — nothing here
 * fetches, converts currency, sums, posts or fabricates. A missing figure is passed as "—", never as a made-up zero.
 */
export type ApprovedPurchasePage = "booking-details" | "purchase-payments" | "orders-payment" | "country-bill-payment" | "loading-records" | "payment-module";
export type PapTone = "dark" | "green" | "red" | "blue";

const TITLE_KEY: Record<ApprovedPurchasePage, string> = {
  "booking-details": "bookingDetails",
  "purchase-payments": "purchasePayments",
  "orders-payment": "orderPayment",
  "country-bill-payment": "countryBill",
  "loading-records": "loadingRecords",
  "payment-module": "purchasePayments", // the page passes its own title (see `title`)
};

export interface PapMetric { label: string; value: string; note?: string; tone?: PapTone }
export interface PapStageRow { key: string; label: string; value: string; count?: string; countLabel?: string; tone: "purple" | "blue" | "red" | "green"; valueTone?: PapTone; onClick?: () => void }
export interface PapCountryRow { key: string; name: string; value: string; count?: string; onClick?: () => void }

export interface PurchaseApprovedHeaderProps {
  page: ApprovedPurchasePage;
  /** page title for the ten Purchase/Sales payment pages (already translated); the five Purchase pages use the built-in titles */
  title?: string;
  /** breadcrumb middle item for the payment pages ("Purchase" / "Sales"), already translated */
  crumbModule?: string;
  /** localized, authorized scope text e.g. "All Countries"; defaults to the localized "All Countries" */
  scopeLabel?: string;
  summary: { title: string; subtitle?: string; metrics: readonly [PapMetric, PapMetric, PapMetric] };
  stages: { title: string; subtitle?: string; rows: readonly PapStageRow[] };
  countries: { title: string; subtitle?: string; rows: readonly PapCountryRow[]; emptyLabel?: string };
  /** the page's EXISTING controls (search, filters, date, refresh, more-actions, New) — compose with the Pap* helpers below */
  toolbar?: ReactNode;
  langProp?: string | null;
}

const Go = () => <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>;
const Bars = () => <span className="dgt-pa-bars" aria-hidden="true"><span /><span /><span /></span>;

export function PurchaseApprovedHeader({ page, title: titleOverride, crumbModule, scopeLabel, summary, stages, countries, toolbar, langProp }: PurchaseApprovedHeaderProps) {
  const s = useErpScreen("pap", langProp);
  const title = titleOverride ?? s.t(TITLE_KEY[page], "Purchase");
  const stageIcon = (tone: PapStageRow["tone"]) => (tone === "green" ? "✓" : tone === "red" ? "◎" : tone === "blue" ? "▵" : "☰");
  return (
    <section className="dgt-pa" dir={s.dir} data-dgt-page={page} aria-label={title}>
      <div className="dgt-pa-head">
        <div className="dgt-pa-title-icon" aria-hidden="true"><FileText /></div>
        <div className="dgt-pa-titles">
          <h1>{title}</h1>
          <div className="dgt-pa-crumbs">
            <span>{s.t("dashboard", "Dashboard")}</span><ChevronRight aria-hidden="true" />
            <span>{crumbModule ?? s.t("purchase", "Purchase")}</span><ChevronRight aria-hidden="true" />
            <span>{title}</span>
          </div>
        </div>
        {toolbar ? <div className="dgt-pa-toolbar">{toolbar}</div> : null}
      </div>

      <div className="dgt-pa-cards">
        <section className="dgt-pa-card gold" aria-label={summary.title}>
          <div className="dgt-pa-card-head">
            <div className="dgt-pa-symbol" aria-hidden="true"><ShoppingCart /></div>
            <div><div className="dgt-pa-headname">{summary.title}</div>{summary.subtitle && <div className="dgt-pa-sub">{summary.subtitle}</div>}</div>
            <Bars />
          </div>
          <div className="dgt-pa-kps">
            {summary.metrics.map((m, i) => (
              <div className="dgt-pa-kp" key={i}>
                <div className="dgt-pa-kp-name">{m.label}</div>
                <div className={cn("dgt-pa-kp-value", `t-${m.tone ?? (i === 1 ? "green" : i === 2 ? "red" : "dark")}`)} data-len={(m.value || "").length > 12 ? "long" : "short"} dir="auto">{m.value || "—"}</div>
                {m.note && <div className={cn("dgt-pa-kp-note", `t-${m.tone ?? (i === 1 ? "green" : i === 2 ? "red" : "dark")}`)} dir="auto">{m.note}</div>}
              </div>
            ))}
          </div>
        </section>

        <section className="dgt-pa-card sky" aria-label={stages.title}>
          <div className="dgt-pa-card-head">
            <div className="dgt-pa-symbol" aria-hidden="true"><Layers /></div>
            <div><div className="dgt-pa-headname">{stages.title}</div>{stages.subtitle && <div className="dgt-pa-sub">{stages.subtitle}</div>}</div>
            <Bars />
          </div>
          <div className="dgt-pa-rows">
            {stages.rows.map((r) => {
              const inner = (
                <>
                  <span className={cn("dgt-pa-row-icon", r.tone)} aria-hidden="true">{stageIcon(r.tone)}</span>
                  <span className="dgt-pa-row-label">{r.label}</span>
                  <span className={cn("dgt-pa-row-amt", `t-${r.valueTone ?? (r.tone === "red" ? "red" : r.tone === "green" ? "green" : "blue")}`)} dir="auto">{r.value || "—"}</span>
                  {(r.countLabel || r.count) && <span className="dgt-pa-row-count" dir="auto">{r.count ?? r.countLabel}{r.count && r.countLabel ? ` ${r.countLabel}` : ""}</span>}
                  <Go />
                </>
              );
              return r.onClick
                ? <button type="button" className="dgt-pa-row" key={r.key} onClick={r.onClick}>{inner}</button>
                : <div className="dgt-pa-row" key={r.key}>{inner}</div>;
            })}
          </div>
        </section>

        <section className="dgt-pa-card mint" aria-label={countries.title}>
          <div className="dgt-pa-card-head">
            <div className="dgt-pa-symbol" aria-hidden="true"><Globe2 /></div>
            <div>
              <div className="dgt-pa-headname">{countries.title}</div>
              <div className="dgt-pa-sub">{countries.subtitle ?? scopeLabel ?? s.t("allCountries", "All Countries")}</div>
            </div>
            <Bars />
          </div>
          <div className="dgt-pa-rows dgt-pa-scroll">
            {countries.rows.length === 0 && <div className="dgt-pa-empty">{countries.emptyLabel ?? "—"}</div>}
            {countries.rows.map((c) => {
              const inner = (
                <>
                  <span className="dgt-pa-country-name">{c.name}</span>
                  <span className="dgt-pa-country-money" dir="auto">{c.value || "—"}</span>
                  {c.count !== undefined && <span className="dgt-pa-country-count" dir="auto">{c.count}</span>}
                  <Go />
                </>
              );
              return c.onClick
                ? <button type="button" className="dgt-pa-country" key={c.key} onClick={c.onClick}>{inner}</button>
                : <div className="dgt-pa-country" key={c.key}>{inner}</div>;
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

/* ── toolbar building blocks: they only WRAP the page's existing state/handlers ───────────────────────────── */

/** Page search (separate from the global ERP search). Controlled by the page's existing search state. */
export function PapSearch({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  return (
    <label className="dgt-pa-ctrl dgt-pa-search">
      <Search aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label ?? placeholder} />
    </label>
  );
}

function usePopoverClose(ref: React.RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const onDown = (e: MouseEvent) => { const el = ref.current; if (el?.open && !el.contains(e.target as Node)) el.open = false; };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && ref.current?.open) ref.current.open = false; };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [ref]);
}

/** "Filters" button that opens a panel holding the page's EXISTING filter controls (children). */
export function PapFilters({ label, badge, children, wide = true }: { label: string; badge?: number; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  usePopoverClose(ref);
  return (
    <details className="dgt-pa-pop" ref={ref}>
      <summary className="dgt-pa-ctrl" style={{ cursor: "pointer" }} aria-label={label}>
        <Filter aria-hidden="true" />{label}{badge ? <span className="dgt-pa-row-count" style={{ minWidth: 0 }} dir="ltr">({badge})</span> : null}
      </summary>
      <div className={cn("dgt-pa-pop-panel", wide && "wide")}>{children}</div>
    </details>
  );
}

/** Refresh / reset icon button — wraps the page's existing refresh handler. */
export function PapRefresh({ onClick, title, spinning }: { onClick: () => void; title: string; spinning?: boolean }) {
  return (
    <button type="button" className="dgt-pa-ctrl dgt-pa-sq" onClick={onClick} title={title} aria-label={title}>
      <RefreshCw className={spinning ? "animate-spin" : undefined} aria-hidden="true" />
    </button>
  );
}

/** Three-dot menu. Items are the page's EXISTING print / PDF / Excel / CSV handlers. */
export function PapMenu({ label, items = [], children }: { label: string; items?: ReadonlyArray<{ key: string; label: string; icon?: ReactNode; onClick: () => void }>; children?: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  usePopoverClose(ref);
  return (
    <details className="dgt-pa-pop" ref={ref}>
      <summary className="dgt-pa-ctrl dgt-pa-sq" style={{ cursor: "pointer" }} aria-label={label} title={label}><MoreVertical aria-hidden="true" /></summary>
      <div className="dgt-pa-pop-panel">
        {items.map((it) => (
          <button type="button" key={it.key} className="dgt-pa-menu-item" onClick={() => { it.onClick(); if (ref.current) ref.current.open = false; }}>{it.icon}{it.label}</button>
        ))}
        {children}
      </div>
    </details>
  );
}

