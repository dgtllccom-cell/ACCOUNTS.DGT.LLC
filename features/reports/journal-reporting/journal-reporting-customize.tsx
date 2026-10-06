"use client";

import { useState } from "react";
import {
  ALL_CARD_KEYS,
  ALL_CHART_KEYS,
  defaultJournalReportConfig,
  type JournalCardKey,
  type JournalChartKey,
  type JournalColumnKey,
  type JournalReportConfig
} from "./default-config";
import type { ErpScreen } from "@/lib/i18n/use-erp-screen";

export function columnLabel(s: ErpScreen, key: JournalColumnKey): string {
  const map: Record<JournalColumnKey, [string, string]> = {
    date: ["col_date", "Date"],
    journalNo: ["col_journal_no", "Journal No."],
    voucherNo: ["col_voucher_no", "Voucher No."],
    referenceNo: ["col_reference", "Reference"],
    accountName: ["col_account", "Account"],
    customerName: ["col_customer", "Customer/Supplier"],
    description: ["col_description", "Description"],
    debit: ["col_debit", "Debit"],
    credit: ["col_credit", "Credit"],
    currency: ["col_currency", "Currency"],
    usdRate: ["col_exchange_rate", "Exchange Rate"],
    companyName: ["col_company", "Company"],
    countryName: ["col_country", "Country"],
    countryBranchName: ["col_branch", "Branch"],
    cityBranchName: ["col_city_branch", "City Branch"],
    createdByName: ["col_created_by", "Created By"],
    approvedByName: ["col_approved_by", "Approved By"],
    status: ["col_status", "Status"]
  };
  const [key2, fallback] = map[key];
  return s.t(key2, fallback);
}

function cardLabel(s: ErpScreen, key: JournalCardKey): string {
  const map: Record<JournalCardKey, [string, string]> = {
    openingBalance: ["kpi_opening_balance", "Opening Balance"],
    totalDebit: ["kpi_total_debit", "Total Debit"],
    totalCredit: ["kpi_total_credit", "Total Credit"],
    closingBalance: ["kpi_closing_balance", "Closing Balance"],
    totalJournalEntries: ["kpi_total_entries", "Total Journal Entries"],
    approvedEntries: ["kpi_approved_entries", "Approved Entries"],
    pendingEntries: ["kpi_pending_entries", "Pending Entries"]
  };
  const [key2, fallback] = map[key];
  return s.t(key2, fallback);
}

function chartLabel(s: ErpScreen, key: JournalChartKey): string {
  const map: Record<JournalChartKey, [string, string]> = {
    debitVsCredit: ["chart_debit_vs_credit", "Debit vs Credit"],
    movementByDate: ["chart_movement_by_date", "Movement by Date"],
    accountWise: ["chart_account_wise", "Account-wise Breakdown"],
    branchWise: ["chart_branch_wise", "Branch-wise Breakdown"],
    currencyWise: ["chart_currency_wise", "Currency-wise Breakdown"]
  };
  const [key2, fallback] = map[key];
  return s.t(key2, fallback);
}

export function JournalReportingCustomize({
  s,
  config,
  onApply,
  onClose
}: {
  s: ErpScreen;
  config: JournalReportConfig;
  onApply: (next: JournalReportConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<JournalReportConfig>(() => JSON.parse(JSON.stringify(config)));

  function toggleColumn(key: JournalColumnKey) {
    setDraft((d) => ({ ...d, columns: d.columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)) }));
  }
  function resizeColumn(key: JournalColumnKey, width: number) {
    setDraft((d) => ({ ...d, columns: d.columns.map((c) => (c.key === key ? { ...c, width } : c)) }));
  }
  function moveColumn(index: number, dir: -1 | 1) {
    setDraft((d) => {
      const next = [...d.columns];
      const target = index + dir;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...d, columns: next };
    });
  }
  function toggleCard(key: JournalCardKey) {
    setDraft((d) => ({
      ...d,
      visibleCards: d.visibleCards.includes(key) ? d.visibleCards.filter((k) => k !== key) : [...d.visibleCards, key]
    }));
  }
  function toggleChart(key: JournalChartKey) {
    setDraft((d) => ({
      ...d,
      visibleCharts: d.visibleCharts.includes(key) ? d.visibleCharts.filter((k) => k !== key) : [...d.visibleCharts, key]
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        dir={s.dir}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">{s.t("customize_title", "Customize Report")}</h2>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{s.t("customize_columns", "Columns")}</h3>
          <div className="space-y-1">
            {draft.columns.map((col, idx) => (
              <div key={col.key} className="flex items-center gap-2 rounded border border-slate-100 px-2 py-1 dark:border-slate-800">
                <input type="checkbox" checked={col.visible} onChange={() => toggleColumn(col.key)} />
                <span className={`flex-1 text-sm ${s.textStart}`}>{columnLabel(s, col.key)}</span>
                <input
                  type="number"
                  min={40}
                  max={500}
                  value={col.width}
                  onChange={(e) => resizeColumn(col.key, Number(e.target.value) || col.width)}
                  className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  title={s.t("customize_width", "Width")}
                />
                <button type="button" onClick={() => moveColumn(idx, -1)} className="rounded px-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title={s.t("customize_move_up", "Move Up")}>
                  ▲
                </button>
                <button type="button" onClick={() => moveColumn(idx, 1)} className="rounded px-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title={s.t("customize_move_down", "Move Down")}>
                  ▼
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{s.t("customize_cards", "Summary Cards")}</h3>
          <div className="flex flex-wrap gap-3">
            {ALL_CARD_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={draft.visibleCards.includes(key)} onChange={() => toggleCard(key)} />
                {cardLabel(s, key)}
              </label>
            ))}
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{s.t("customize_charts", "Charts")}</h3>
          <div className="flex flex-wrap gap-3">
            {ALL_CHART_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={draft.visibleCharts.includes(key)} onChange={() => toggleChart(key)} />
                {chartLabel(s, key)}
              </label>
            ))}
          </div>
        </section>

        <section className="mb-5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.showTotalsRow}
              onChange={() => setDraft((d) => ({ ...d, showTotalsRow: !d.showTotalsRow }))}
            />
            {s.t("total_row", "Totals")}
          </label>
        </section>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setDraft(defaultJournalReportConfig())}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {s.t("customize_reset", "Reset to Default")}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {s.t("customize_close", "Close")}
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {s.t("customize_apply", "Apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
