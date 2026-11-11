"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronRight, FileText, Filter, Globe2, Layers, MoreVertical, RefreshCw, Search, ShoppingCart, WalletCards } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { localizeCountryName } from "@/lib/i18n/country-names";
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

export interface PapSummaryRow {
  key: string;
  label: string;
  totalBills: number;
  paidBills: number;
  remainingBills: number;
  onFilterTotal?: () => void;
  onFilterPaid?: () => void;
  onFilterRemaining?: () => void;
}

export interface PapTwoCurrencyRow {
  key: string;
  label: string;
  purchAmt: string;
  finalAmt: string;
  isTotal?: boolean;
  onClick?: () => void;
}

export interface PapAdvanceCardsData {
  summary: {
    title: string;
    rows: Array<{
      description: string;
      bills: number;
      purchaseAmt: string;
      finalAmt: string;
    }>;
  };
  status: {
    title: string;
    rows: Array<{
      status: string;
      dotColor: "green" | "blue" | "orange";
      bills: number;
      pct: string;
      isTotal?: boolean;
    }>;
  };
  branchWise: {
    title: string;
    rows: Array<{
      branch: string;
      bills: number;
      advReq: string;
      advPaid: string;
      advBal: string;
      isTotal?: boolean;
    }>;
  };
}

export interface ScopeUserInfo {
  countryCode?: string;
  branchCode?: string;
  userCode?: string;
  userName?: string;
  role?: string;
}

export interface PurchaseApprovedHeaderProps {
  page: ApprovedPurchasePage;
  /** page title for the ten Purchase/Sales payment pages (already translated); the five Purchase pages use the built-in titles */
  title?: string;
  /** breadcrumb middle item for the payment pages ("Purchase" / "Sales"), already translated */
  crumbModule?: string;
  /** localized, authorized scope text e.g. "All Countries"; defaults to the localized "All Countries" */
  scopeLabel?: string;
  summary: { title: string; subtitle?: string; metrics?: readonly [PapMetric, PapMetric, PapMetric]; summaryRows?: readonly PapSummaryRow[] };
  stages: { title: string; subtitle?: string; rows: readonly PapStageRow[]; twoCurrencyRows?: readonly PapTwoCurrencyRow[] };
  countries: { title: string; subtitle?: string; rows: readonly PapCountryRow[]; emptyLabel?: string; branchScopeInfo?: ScopeUserInfo };
  advanceCards?: PapAdvanceCardsData;
  /** the page's EXISTING controls (search, filters, date, refresh, more-actions, New) — compose with the Pap* helpers below */
  toolbar?: ReactNode;
  langProp?: string | null;
}

const Go = () => <span className="dgt-pa-go" aria-hidden="true"><ChevronRight /></span>;
const Bars = () => <span className="dgt-pa-bars" aria-hidden="true"><span /><span /><span /></span>;

export function PurchaseApprovedHeader({ page, title: titleOverride, crumbModule, scopeLabel, summary, stages, countries, advanceCards, toolbar, langProp }: PurchaseApprovedHeaderProps) {
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
        {advanceCards ? (
          <>
            {/* Card 1 (Gold): Advance Payment Summary */}
            <section className="dgt-pa-card gold" aria-label={advanceCards.summary.title}>
              <div className="dgt-pa-card-head">
                <div className="dgt-pa-symbol" aria-hidden="true"><ShoppingCart /></div>
                <div><div className="dgt-pa-headname">{advanceCards.summary.title}</div></div>
                <Bars />
              </div>
              <div className="p-0.5 px-1.5 overflow-hidden flex-1 flex flex-col justify-between">
                <table className="w-full table-fixed text-[10.5px] leading-tight border-collapse">
                  <thead>
                    <tr className="border-b border-amber-300/80 text-[9px] font-black text-slate-700 uppercase">
                      <th className="w-[44%] py-0.5 px-1 text-start whitespace-normal leading-tight">{s.t("description", "Description")}</th>
                      <th className="w-[12%] py-0.5 px-0.5 text-center whitespace-normal leading-tight">{s.t("totalBills", "Bills")}</th>
                      <th className="w-[22%] py-0.5 px-1 text-end whitespace-normal leading-tight">{s.t("totalAmtPurchase", "Purchase")}</th>
                      <th className="w-[22%] py-0.5 px-1 text-end whitespace-normal leading-tight">{s.t("totalAmtFinal", "Final")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-200/50">
                    {advanceCards.summary.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-amber-100/40 transition-colors">
                        <td className="py-0.5 px-1 text-start font-bold text-slate-800 truncate" title={r.description}>{r.description}</td>
                        <td className="py-0.5 px-0.5 text-center font-mono font-bold text-slate-900">{r.bills}</td>
                        <td className="py-0.5 px-1 text-end font-mono font-bold text-blue-700 truncate" dir="ltr">{r.purchaseAmt}</td>
                        <td className="py-0.5 px-1 text-end font-mono font-semibold text-slate-600 truncate" dir="ltr">{r.finalAmt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Card 2 (Sky): Payment Status */}
            <section className="dgt-pa-card sky" aria-label={advanceCards.status.title}>
              <div className="dgt-pa-card-head">
                <div className="dgt-pa-symbol" aria-hidden="true"><Layers /></div>
                <div><div className="dgt-pa-headname">{advanceCards.status.title}</div></div>
                <Bars />
              </div>
              <div className="p-0.5 px-1.5 overflow-hidden flex-1 flex flex-col justify-between">
                <table className="w-full table-fixed text-[10.5px] leading-tight border-collapse">
                  <thead>
                    <tr className="border-b border-blue-300/80 text-[9px] font-black text-slate-700 uppercase">
                      <th className="w-[48%] py-0.5 px-1 text-start whitespace-normal leading-tight">{s.t("status", "Status")}</th>
                      <th className="w-[22%] py-0.5 px-1 text-center whitespace-normal leading-tight">{s.t("bills", "Bills")}</th>
                      <th className="w-[30%] py-0.5 px-1 text-end whitespace-normal leading-tight">{s.t("pctOfBills", "% of Bills")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-200/50">
                    {advanceCards.status.rows.map((r, i) => (
                      <tr key={i} className={cn("hover:bg-blue-100/40 transition-colors", r.isTotal && "font-black bg-blue-100/60")}>
                        <td className="py-0.5 px-1 text-start font-bold flex items-center gap-1.5 truncate">
                          {!r.isTotal && (
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full flex-none",
                              r.dotColor === "green" ? "bg-emerald-500" :
                              r.dotColor === "blue" ? "bg-blue-500" : "bg-amber-500"
                            )} />
                          )}
                          <span className="truncate">{r.status}</span>
                        </td>
                        <td className="py-0.5 px-1 text-center font-mono font-bold text-slate-900">{r.bills}</td>
                        <td className="py-0.5 px-1 text-end font-mono font-bold text-slate-700" dir="ltr">{r.pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Card 3 (Mint): Branch Wise (Advance) */}
            <section className="dgt-pa-card mint" aria-label={advanceCards.branchWise.title}>
              <div className="dgt-pa-card-head">
                <div className="dgt-pa-symbol" aria-hidden="true"><Globe2 /></div>
                <div><div className="dgt-pa-headname">{advanceCards.branchWise.title}</div></div>
                <Bars />
              </div>
              <div className="p-0.5 px-1.5 overflow-hidden flex-1 flex flex-col justify-between">
                <table className="w-full table-fixed text-[10.5px] leading-tight border-collapse">
                  <thead>
                    <tr className="border-b border-emerald-300/80 text-[9px] font-black text-slate-700 uppercase">
                      <th className="w-[24%] py-0.5 px-1 text-start whitespace-normal leading-tight">{s.t("branch", "Branch")}</th>
                      <th className="w-[12%] py-0.5 px-0.5 text-center whitespace-normal leading-tight">{s.t("bills", "Bills")}</th>
                      <th className="w-[22%] py-0.5 px-1 text-end whitespace-normal leading-tight">{s.t("advRequired", "Adv Required")}</th>
                      <th className="w-[21%] py-0.5 px-1 text-end whitespace-normal leading-tight">{s.t("advPaid", "Adv Paid")}</th>
                      <th className="w-[21%] py-0.5 px-1 text-end whitespace-normal leading-tight">{s.t("advBalance", "Adv Balance")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-200/50">
                    {advanceCards.branchWise.rows.map((r, i) => (
                      <tr key={i} className={cn("hover:bg-emerald-100/40 transition-colors", r.isTotal && "font-black bg-emerald-100/60")}>
                        <td className="py-0.5 px-1 text-start font-bold text-slate-800 truncate" title={r.branch}>{r.branch}</td>
                        <td className="py-0.5 px-0.5 text-center font-mono font-bold text-slate-900">{r.bills}</td>
                        <td className="py-0.5 px-1 text-end font-mono font-bold text-blue-700 truncate" dir="ltr">{r.advReq}</td>
                        <td className="py-0.5 px-1 text-end font-mono font-bold text-emerald-600 truncate" dir="ltr">{r.advPaid}</td>
                        <td className="py-0.5 px-1 text-end font-mono font-bold text-rose-600 truncate" dir="ltr">{r.advBal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="dgt-pa-card gold" aria-label={summary.title}>
              <div className="dgt-pa-card-head">
                <div className="dgt-pa-symbol" aria-hidden="true"><ShoppingCart /></div>
                <div><div className="dgt-pa-headname">{summary.title}</div>{summary.subtitle && <div className="dgt-pa-sub">{summary.subtitle}</div>}</div>
                <Bars />
              </div>
              {summary.summaryRows && summary.summaryRows.length > 0 ? (
                <div className="p-2 overflow-x-auto">
                  <table className="dgt-pa-summary-table">
                    <thead>
                      <tr>
                        <th className="text-left">{s.t("sourceCategory", "Category")}</th>
                        <th className="text-center">{s.t("totalBills", "Total Bills")}</th>
                        <th className="text-center">{s.t("paidBills", "Paid")}</th>
                        <th className="text-center">{s.t("remainingBills", "Remaining")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.summaryRows.map((row) => (
                        <tr key={row.key}>
                          <td className="dgt-pa-summary-rowname">{row.label}</td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="dgt-pa-summary-btn total"
                              title={s.t("filterTotalBills", "Filter All Bills")}
                              onClick={row.onFilterTotal}
                            >
                              {row.totalBills}
                            </button>
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="dgt-pa-summary-btn paid"
                              title={s.t("filterPaidBills", "Filter Paid Bills")}
                              onClick={row.onFilterPaid}
                            >
                              {row.paidBills}
                            </button>
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="dgt-pa-summary-btn remaining"
                              title={s.t("filterRemainingBills", "Filter Remaining Bills")}
                              onClick={row.onFilterRemaining}
                            >
                              {row.remainingBills}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="dgt-pa-kps">
                  {(summary.metrics || []).map((m, i) => (
                    <div className="dgt-pa-kp" key={i}>
                      <div className="dgt-pa-kp-name">{m.label}</div>
                      <div className={cn("dgt-pa-kp-value", `t-${m.tone ?? (i === 1 ? "green" : i === 2 ? "red" : "dark")}`)} data-len={(m.value || "").length > 12 ? "long" : "short"} dir="auto">{m.value || "—"}</div>
                      {m.note && <div className={cn("dgt-pa-kp-note", `t-${m.tone ?? (i === 1 ? "green" : i === 2 ? "red" : "dark")}`)} dir="auto">{m.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="dgt-pa-card sky" aria-label={stages.title}>
              <div className="dgt-pa-card-head">
                <div className="dgt-pa-symbol" aria-hidden="true"><Layers /></div>
                <div><div className="dgt-pa-headname">{stages.title}</div>{stages.subtitle && <div className="dgt-pa-sub">{stages.subtitle}</div>}</div>
                <Bars />
              </div>
              {stages.twoCurrencyRows ? (
                <div className="p-1 px-2 overflow-x-auto flex-1 flex flex-col justify-between">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-blue-200/80 text-[10px] font-black text-slate-600 uppercase">
                        <th className="py-1 px-2 text-start whitespace-nowrap">{s.t("paymentType", "Payment Type")}</th>
                        <th className="py-1 px-2 text-end whitespace-nowrap">{s.t("purchaseAmount", "Purchase Amount")}</th>
                        <th className="py-1 px-2 text-end whitespace-nowrap">{s.t("finalAmount", "Final Amount")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100">
                      {stages.twoCurrencyRows.map((r) => {
                        if (r.isTotal) {
                          return (
                            <tr key={r.key} className="bg-[#1e40af] text-white font-black">
                              <td className="py-1 px-2 text-start flex items-center gap-1.5 whitespace-nowrap">
                                <WalletCards className="h-3.5 w-3.5 text-blue-200" />
                                <span>{r.label}</span>
                              </td>
                              <td className="py-1 px-2 text-end font-mono text-white" dir="ltr">{r.purchAmt}</td>
                              <td className="py-1 px-2 text-end font-mono text-white" dir="ltr">{r.finalAmt}</td>
                            </tr>
                          );
                        }
                        return (
                          <tr
                            key={r.key}
                            onClick={r.onClick}
                            className={cn(
                              "hover:bg-blue-50/70 transition-colors text-slate-800",
                              r.onClick && "cursor-pointer"
                            )}
                          >
                            <td className="py-0.5 px-2 text-start font-bold flex items-center gap-1.5 whitespace-nowrap">
                              <span className={cn(
                                "h-2 w-2 rounded-full flex-none",
                                r.key === "advance" ? "bg-purple-600" :
                                r.key === "remaining" ? "bg-rose-500" :
                                r.key === "endorsement" ? "bg-blue-600" : "bg-red-500"
                              )} />
                              <span>{r.label}</span>
                            </td>
                            <td className="py-0.5 px-2 text-end font-mono font-bold text-blue-700 whitespace-nowrap" dir="ltr">
                              {r.purchAmt}
                            </td>
                            <td className="py-0.5 px-2 text-end font-mono font-semibold text-slate-600 whitespace-nowrap" dir="ltr">
                              {r.finalAmt}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
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
              )}
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
              {countries.branchScopeInfo ? (
                <div className="dgt-pa-scope-card">
                  <div className="dgt-pa-scope-item"><span className="dgt-pa-scope-key">{s.t("countryCode", "Country Code")}:</span><span className="dgt-pa-scope-val">{countries.branchScopeInfo.countryCode || "—"}</span></div>
                  <div className="dgt-pa-scope-item"><span className="dgt-pa-scope-key">{s.t("branchCode", "Branch Code")}:</span><span className="dgt-pa-scope-val">{countries.branchScopeInfo.branchCode || "—"}</span></div>
                  <div className="dgt-pa-scope-item"><span className="dgt-pa-scope-key">{s.t("userCode", "User Code")}:</span><span className="dgt-pa-scope-val">{countries.branchScopeInfo.userCode || "—"}</span></div>
                  <div className="dgt-pa-scope-item"><span className="dgt-pa-scope-key">{s.t("userName", "User Name")}:</span><span className="dgt-pa-scope-val truncate max-w-[130px]" title={countries.branchScopeInfo.userName}>{countries.branchScopeInfo.userName || "—"}</span></div>
                  <div className="dgt-pa-scope-item"><span className="dgt-pa-scope-key">{s.t("role", "Role")}:</span><span className="dgt-pa-scope-val text-blue-600 dark:text-blue-400 font-bold uppercase">{countries.branchScopeInfo.role || "—"}</span></div>
                </div>
              ) : (
                <div className="dgt-pa-rows dgt-pa-scroll">
                  {countries.rows.length === 0 && <div className="dgt-pa-empty">{countries.emptyLabel ?? "—"}</div>}
                  {countries.rows.map((c) => {
                    const inner = (
                      <>
                        <span className="dgt-pa-country-name">{localizeCountryName(c.name, s.lang)}</span>
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
              )}
            </section>
          </>
        )}
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

