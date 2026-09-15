// Journal Reporting — "Customize Report" config shape. Persisted per-user via the existing
// saved_reports table (module = "journal_reporting", config jsonb) through the already-built
// app/api/erp/reports/saved routes — no new saved-views table.

export type JournalColumnKey =
  | "date"
  | "journalNo"
  | "voucherNo"
  | "referenceNo"
  | "accountName"
  | "customerName"
  | "description"
  | "debit"
  | "credit"
  | "currency"
  | "usdRate"
  | "companyName"
  | "countryName"
  | "countryBranchName"
  | "cityBranchName"
  | "createdByName"
  | "approvedByName"
  | "status";

export type JournalCardKey =
  | "openingBalance"
  | "totalDebit"
  | "totalCredit"
  | "closingBalance"
  | "totalJournalEntries"
  | "approvedEntries"
  | "pendingEntries";

export type JournalChartKey = "debitVsCredit" | "movementByDate" | "accountWise" | "branchWise" | "currencyWise";

export type JournalColumnConfig = { key: JournalColumnKey; visible: boolean; width: number };

export type JournalReportConfig = {
  version: 1;
  /** Order of this array IS the column display order. */
  columns: JournalColumnConfig[];
  visibleCards: JournalCardKey[];
  visibleCharts: JournalChartKey[];
  showTotalsRow: boolean;
};

export const ALL_COLUMN_KEYS: JournalColumnKey[] = [
  "date",
  "journalNo",
  "voucherNo",
  "referenceNo",
  "accountName",
  "customerName",
  "description",
  "debit",
  "credit",
  "currency",
  "usdRate",
  "companyName",
  "countryName",
  "countryBranchName",
  "cityBranchName",
  "createdByName",
  "approvedByName",
  "status"
];

export const ALL_CARD_KEYS: JournalCardKey[] = [
  "openingBalance",
  "totalDebit",
  "totalCredit",
  "closingBalance",
  "totalJournalEntries",
  "approvedEntries",
  "pendingEntries"
];

export const ALL_CHART_KEYS: JournalChartKey[] = ["debitVsCredit", "movementByDate", "accountWise", "branchWise", "currencyWise"];

const DEFAULT_WIDTHS: Record<JournalColumnKey, number> = {
  date: 100,
  journalNo: 110,
  voucherNo: 110,
  referenceNo: 120,
  accountName: 180,
  customerName: 160,
  description: 220,
  debit: 110,
  credit: 110,
  currency: 80,
  usdRate: 90,
  companyName: 150,
  countryName: 110,
  countryBranchName: 140,
  cityBranchName: 140,
  createdByName: 140,
  approvedByName: 140,
  status: 100
};

export function defaultJournalReportConfig(): JournalReportConfig {
  return {
    version: 1,
    columns: ALL_COLUMN_KEYS.map((key) => ({ key, visible: true, width: DEFAULT_WIDTHS[key] })),
    visibleCards: [...ALL_CARD_KEYS],
    visibleCharts: [...ALL_CHART_KEYS],
    showTotalsRow: true
  };
}

/** Merge a persisted/partial config with the current default shape — new columns added later
 *  (or an older saved view missing a key) always fall back to the default rather than vanishing. */
export function normalizeJournalReportConfig(input: unknown): JournalReportConfig {
  const base = defaultJournalReportConfig();
  if (!input || typeof input !== "object") return base;
  const cfg = input as Partial<JournalReportConfig>;

  const savedColumns = Array.isArray(cfg.columns) ? cfg.columns : [];
  const savedByKey = new Map(savedColumns.filter((c) => c && ALL_COLUMN_KEYS.includes(c.key)).map((c) => [c.key, c]));
  const orderedKeys = [
    ...savedColumns.map((c) => c?.key).filter((k): k is JournalColumnKey => !!k && ALL_COLUMN_KEYS.includes(k)),
    ...ALL_COLUMN_KEYS.filter((k) => !savedByKey.has(k))
  ];
  const columns = orderedKeys.map((key) => {
    const saved = savedByKey.get(key);
    return {
      key,
      visible: saved?.visible ?? true,
      width: typeof saved?.width === "number" && saved.width > 20 ? saved.width : DEFAULT_WIDTHS[key]
    };
  });

  const visibleCards = Array.isArray(cfg.visibleCards)
    ? cfg.visibleCards.filter((k): k is JournalCardKey => ALL_CARD_KEYS.includes(k as JournalCardKey))
    : base.visibleCards;
  const visibleCharts = Array.isArray(cfg.visibleCharts)
    ? cfg.visibleCharts.filter((k): k is JournalChartKey => ALL_CHART_KEYS.includes(k as JournalChartKey))
    : base.visibleCharts;

  return {
    version: 1,
    columns,
    visibleCards: visibleCards.length ? visibleCards : base.visibleCards,
    visibleCharts,
    showTotalsRow: typeof cfg.showTotalsRow === "boolean" ? cfg.showTotalsRow : true
  };
}

export type JournalFilters = {
  fromDate: string;
  toDate: string;
  datePreset: string;
  countryId: string;
  countryBranchId: string;
  cityBranchId: string;
  companyId: string;
  ledgerId: string;
  customerId: string;
  journalType: string;
  voucherType: string;
  currency: string;
  createdBy: string;
  approvedBy: string;
  approvalStatus: string;
  status: string;
  drCr: string;
  referenceNo: string;
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeDatePreset(preset: string): { fromDate: string; toDate: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (preset) {
    case "today":
      return { fromDate: fmt(now), toDate: fmt(now) };
    case "yesterday": {
      const yst = new Date(y, m, d - 1);
      return { fromDate: fmt(yst), toDate: fmt(yst) };
    }
    case "this_week": {
      const day = now.getDay(); // 0 = Sunday
      const start = new Date(y, m, d - day);
      return { fromDate: fmt(start), toDate: fmt(now) };
    }
    case "this_month":
      return { fromDate: fmt(new Date(y, m, 1)), toDate: fmt(now) };
    case "this_quarter": {
      const qStartMonth = Math.floor(m / 3) * 3;
      return { fromDate: fmt(new Date(y, qStartMonth, 1)), toDate: fmt(now) };
    }
    case "this_year":
      return { fromDate: fmt(new Date(y, 0, 1)), toDate: fmt(now) };
    case "prev_month": {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { fromDate: fmt(start), toDate: fmt(end) };
    }
    case "prev_year": {
      return { fromDate: fmt(new Date(y - 1, 0, 1)), toDate: fmt(new Date(y - 1, 11, 31)) };
    }
    default:
      return { fromDate: fmt(new Date(y, m, 1)), toDate: fmt(now) };
  }
}

export function defaultJournalFilters(): JournalFilters {
  const { fromDate, toDate } = computeDatePreset("this_month");
  return {
    fromDate,
    toDate,
    datePreset: "this_month",
    countryId: "",
    countryBranchId: "",
    cityBranchId: "",
    companyId: "",
    ledgerId: "",
    customerId: "",
    journalType: "",
    voucherType: "",
    currency: "",
    createdBy: "",
    approvedBy: "",
    approvalStatus: "",
    status: "",
    drCr: "",
    referenceNo: ""
  };
}
