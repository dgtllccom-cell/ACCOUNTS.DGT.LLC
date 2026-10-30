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

/** Journal table footer: "Showing x to y of N entries", rows per page, previous / numbered pages / next. */
export function CjPagination({
  lang, page, pageSize, total, onPage, onPageSize,
}: { lang?: string | null; page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize: (n: number) => void }) {
  const s = useErpScreen("cj", lang);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Build visible page numbers (e.g. 1, 2, 3, 4, 5, ..., last)
  const pageNumbers: Array<number | "ellipsis"> = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (page > 4) pageNumbers.push("ellipsis");
    const start = Math.max(2, Math.min(page - 1, pages - 4));
    const end = Math.min(pages - 1, Math.max(page + 1, 5));
    for (let i = start; i <= end; i++) pageNumbers.push(i);
    if (page < pages - 3) pageNumbers.push("ellipsis");
    pageNumbers.push(pages);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 px-4 py-3 text-xs text-slate-600 dark:text-slate-400" dir={s.dir}>
      <div className="flex items-center gap-4">
        <span className="font-medium text-slate-600 dark:text-slate-400" dir="ltr">
          {s.t("showing", "Showing")} <strong className="font-bold text-slate-800 dark:text-slate-200">{from}</strong> {s.t("to", "to")} <strong className="font-bold text-slate-800 dark:text-slate-200">{to}</strong> {s.t("of", "of")} <strong className="font-bold text-slate-800 dark:text-slate-200">{total}</strong> {s.t("entries", "entries")}
        </span>
        <label className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <span>{s.t("rowsPerPage", "Rows")}</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
          >
            {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1" dir="ltr">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {s.t("prev", "Previous")}
        </button>
        {pageNumbers.map((item, idx) =>
          item === "ellipsis" ? (
            <span key={`el-${idx}`} className="px-1.5 text-slate-400 font-semibold">...</span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPage(item)}
              className={
                item === page
                  ? "inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg bg-blue-600 px-2.5 text-xs font-bold text-white shadow-xs cursor-pointer"
                  : "inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              }
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {s.t("next", "Next")}
        </button>
      </div>
    </div>
  );
}
