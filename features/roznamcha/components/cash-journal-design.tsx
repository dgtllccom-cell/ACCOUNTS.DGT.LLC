"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, MoreVertical, SlidersHorizontal, WalletCards } from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { EMPTY_JOURNAL_FILTERS, type JournalFilters } from "../lib/journal-view";
import "./cash-journal.css";

/**
 * Cash Journal — presentation pieces only (heading, journal-actions menu, Filters dialog, "Amount & Payment" summary, pagination).
 * Every figure and handler is handed in by CashEntryForm (the existing module): nothing here reads, calculates, posts or stores
 * accounting data, and no rate, balance or scope is decided in this file. Strings come from the central dictionary (`cj.*`).
 */

export function CjHeading({ lang, title, onBack }: { lang?: string | null; title: string; onBack?: () => void }) {
  const s = useErpScreen("cj", lang);
  return (
    <div className="dgt-cj-heading" dir={s.dir}>
      <span className="dgt-cj-heading-icon" aria-hidden="true"><WalletCards /></span>
      <div className="dgt-cj-heading-text">
        <h1>{title}</h1>
        <p>{s.t("subtitle", "Record cash transactions with multi-currency support inside your authorized scope.")}</p>
      </div>
      {onBack ? (
        <button type="button" className="dgt-cj-ctrl dgt-cj-heading-back" onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> {s.t("backToRegister", "Back to Register")}
        </button>
      ) : null}
    </div>
  );
}

export type CjMenuItem = { key: string; label: string; icon?: ReactNode; onClick: () => void; disabled?: boolean };

/** Three-dot journal-actions menu (Print, Download PDF, Refresh). Pure presentation: each item just calls the handler it was given. */
export function CjActionsMenu({ lang, items }: { lang?: string | null; items: CjMenuItem[] }) {
  const s = useErpScreen("cj", lang);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false; };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && ref.current?.open) ref.current.open = false; };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);
  return (
    <details className="dgt-cj-menu" ref={ref} dir={s.dir}>
      <summary className="dgt-cj-ctrl dgt-cj-ctrl-icon" aria-label={s.t("journalActions", "Journal actions")} title={s.t("journalActions", "Journal actions")}>
        <MoreVertical aria-hidden="true" />
      </summary>
      <div className="dgt-cj-menu-panel" role="menu">
        <div className="dgt-cj-menu-label">{s.t("journalActions", "Journal actions")}</div>
        {items.map((it) => (
          <button key={it.key} type="button" role="menuitem" disabled={it.disabled} className="dgt-cj-menu-item"
            onClick={() => { if (ref.current) ref.current.open = false; it.onClick(); }}>
            {it.icon}<span>{it.label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

export type CjFilterValues = JournalFilters;
export const cjActiveFilterCount = (v: JournalFilters) => Object.values(v).filter(Boolean).length;

/** Filters button with the active-filter badge (opens the dialog). */
export function CjFiltersButton({ lang, count, onClick }: { lang?: string | null; count: number; onClick: () => void }) {
  const s = useErpScreen("cj", lang);
  return (
    <button type="button" className="dgt-cj-ctrl dgt-cj-filters-btn" onClick={onClick} aria-haspopup="dialog">
      <SlidersHorizontal aria-hidden="true" />
      <span>{s.t("filters", "Filters")}</span>
      {count > 0 ? <span className="dgt-cj-count" dir="ltr">{count}</span> : null}
      <ChevronDown className="dgt-cj-chev" aria-hidden="true" />
    </button>
  );
}

/** Filter dialog. The criteria are applied client-side by the form over the rows its scoped API already returned. */
export function CjFiltersDialog({
  lang, open, onClose, value, onApply, currencies, branches,
}: {
  lang?: string | null; open: boolean; onClose: () => void; value: CjFilterValues; onApply: (v: CjFilterValues) => void;
  currencies: string[]; branches: string[];
}) {
  const s = useErpScreen("cj", lang);
  const [draft, setDraft] = useState<CjFilterValues>(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);
  if (!open) return null;
  const set = (k: keyof CjFilterValues, v: string) => setDraft((d) => ({ ...d, [k]: v }) as CjFilterValues);
  return (
    <SimpleModal title={s.t("filterTitle", "Filter Journal Entries")} onClose={onClose} className="dgt-cj-filter-modal max-w-xl">
      <form className="dgt-cj-filter-body" dir={s.dir}
        onSubmit={(e) => { e.preventDefault(); onApply(draft); onClose(); }}>
        <p className="dgt-cj-filter-sub">{s.t("filterSub", "Choose criteria, then apply them to the journal. Only entries inside your authorized scope are listed.")}</p>
        <div className="dgt-cj-filter-caption">{s.t("filterCaption", "JOURNAL SEARCH & SCOPE")}</div>
        <div className="dgt-cj-filter-grid">
          <label className="dgt-cj-field">
            <span>{s.t("fType", "Journal Type")}</span>
            <select value={draft.type} onChange={(e) => set("type", e.target.value)}>
              <option value="">{s.t("fAllTypes", "All Types")}</option>
              <option value="credit">{s.t("fCredit", "Credit (Money Received)")}</option>
              <option value="debit">{s.t("fDebit", "Debit (Money Paid)")}</option>
            </select>
          </label>
          <label className="dgt-cj-field">
            <span>{s.t("fCurrency", "Currency")}</span>
            <select value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
              <option value="">{s.t("fAllCurrencies", "All Currencies")}</option>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="dgt-cj-field">
            <span>{s.t("fBranch", "Branch Code")}</span>
            <select value={draft.branch} onChange={(e) => set("branch", e.target.value)}>
              <option value="">{s.t("fAllBranches", "All Branches")}</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label className="dgt-cj-field">
            <span>{s.t("fReference", "Reference / Number")}</span>
            <input value={draft.reference} onChange={(e) => set("reference", e.target.value)} placeholder={s.t("fReferencePh", "Enter reference...")} />
          </label>
        </div>
        <div className="dgt-cj-filter-actions">
          <button type="button" className="dgt-cj-ctrl" onClick={() => { setDraft(EMPTY_JOURNAL_FILTERS); onApply(EMPTY_JOURNAL_FILTERS); onClose(); }}>{s.t("clearAll", "Clear All")}</button>
          <span className="dgt-cj-spacer" />
          <button type="button" className="dgt-cj-ctrl" onClick={onClose}>{s.t("cancel", "Cancel")}</button>
          <button type="submit" className="dgt-cj-ctrl dgt-cj-primary">{s.t("apply", "Apply Filters")}</button>
        </div>
      </form>
    </SimpleModal>
  );
}

/** "Amount & Payment" summary — plain sums of the USD columns the journal table already shows (no extra conversion). */
export function CjSummaryCard({
  lang, creditText, debitText, diffText, diffZero, creditCount, debitCount, missingRate, scopeText,
}: {
  lang?: string | null; creditText: string; debitText: string; diffText: string; diffZero: boolean; creditCount: number; debitCount: number;
  missingRate: number; scopeText: string;
}) {
  const s = useErpScreen("cj", lang);
  return (
    <section className="dgt-cj-summary" dir={s.dir} aria-label={s.t("amountPayment", "Amount & Payment (USD)")}>
      <h4><span className="dgt-cj-badge" aria-hidden="true">$</span>{s.t("amountPayment", "Amount & Payment (USD)")}</h4>
      <div className="dgt-cj-sum-row"><span>{s.t("totalCredit", "Total Credit")}</span><b className="dgt-cj-credit" dir="ltr">{creditText}</b></div>
      <div className="dgt-cj-sum-row"><span>{s.t("totalDebit", "Total Debit")}</span><b className="dgt-cj-debit" dir="ltr">{debitText}</b></div>
      <div className="dgt-cj-sum-row dgt-cj-sum-diff"><span>{s.t("difference", "Difference")}</span><b className={diffZero ? "dgt-cj-credit" : ""} dir="ltr">{diffText}</b></div>
      <div className="dgt-cj-sum-counts">
        <span>{s.t("creditEntries", "Credit entries")} <b dir="ltr">{creditCount}</b></span>
        <span>{s.t("debitEntries", "Debit entries")} <b dir="ltr">{debitCount}</b></span>
      </div>
      {missingRate > 0 ? <small className="dgt-cj-note">{s.t("missingRate", "Entries without a recorded rate are not converted:")} <b dir="ltr">{missingRate}</b></small> : null}
      <small className="dgt-cj-scope">{scopeText}</small>
    </section>
  );
}

/** Journal table footer: "Showing x to y of N entries", rows per page, previous / next. */
export function CjPagination({
  lang, page, pageSize, total, onPage, onPageSize,
}: { lang?: string | null; page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize: (n: number) => void }) {
  const s = useErpScreen("cj", lang);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="dgt-cj-pager" dir={s.dir}>
      <span className="dgt-cj-range" dir="ltr">{s.t("showing", "Showing")} {from} {s.t("to", "to")} {to} {s.t("of", "of")} {total} {s.t("entries", "entries")}</span>
      <label className="dgt-cj-rows">
        <span>{s.t("rowsPerPage", "Rows per page")}</span>
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
          {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="dgt-cj-pages">
        <button type="button" className="dgt-cj-ctrl" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="dgt-cj-flip" aria-hidden="true" /> {s.t("prev", "Previous")}
        </button>
        <span className="dgt-cj-page-no" dir="ltr">{page} / {pages}</span>
        <button type="button" className="dgt-cj-ctrl" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {s.t("next", "Next")} <ChevronRight className="dgt-cj-flip" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
