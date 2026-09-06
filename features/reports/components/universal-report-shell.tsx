"use client";

/**
 * UniversalReportShell — the ONE canonical layout every ERP report screen uses.
 *
 * Structure (matches the approved Payment Report reference design):
 *   1. Context banner  — location-aware background, title, subtitle, scope line
 *   2. Unified toolbar — a single "Search & Select Report" dropdown (search field
 *                        + grouped page-specific options) + one Filters popover
 *                        (Date range / Country / State / City / Branch / Status)
 *                        + Refresh + Actions (PDF preview, PDF download, Print, CSV)
 *   3. Four universal cards:
 *        Card 1  Branch & User Details  (fixed field set — always the same)
 *        Card 2  Module / Financial Summary   (module supplies rows)
 *        Card 3  Entries & Status Summary     (module supplies rows)
 *        Card 4  Country / Branch / User Report (module supplies rows)
 *   4. Detailed data table (module supplies columns + rows + totals)
 *
 * Everything is data-driven via props, five-language aware via useErpScreen, and
 * RTL/LTR correct. No hard-coded totals — every number comes from the caller.
 * The SAME `cards` / `table` / `branchUser` data also feeds buildUniversalReportHtml()
 * so the PDF and print output match the screen exactly.
 */

import { useMemo, useState, useRef, useEffect } from "react";
import {
  Search, SlidersHorizontal, RefreshCw, ChevronDown, Download, Printer,
  FileSpreadsheet, FileText, Building2, Globe2, Users, Wallet, ClipboardList,
  CheckCircle2, Clock, MapPin, X, Check, Eye,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { cn } from "@/lib/utils";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";

// ── Types ────────────────────────────────────────────────────────────────────

export type ReportOptionGroup = {
  /** i18n'd group heading, e.g. "Payment Reports" */
  label: string;
  items: Array<{ value: string; label: string; icon?: React.ReactNode }>;
};

export type ReportFilterState = {
  dateFrom: string; // ISO yyyy-mm-dd or ""
  dateTo: string;
  countryId: string; // "" = all
  stateId: string;
  cityId: string;
  branchId: string;
  status: string; // "" = all
};

export type ReportMetaOption = { id: string; name: string; code?: string | null };

export type BranchUserDetails = {
  country: string;
  state: string;
  city: string;
  branchName: string;
  branchCode: string;
  userId: string;
  userName: string;
  role: string;
  accessScope: string;
  dateTime: string;
  online: boolean;
};

export type ReportCardRow = {
  label: string;
  value: string | number;
  tone?: "default" | "positive" | "negative" | "muted" | "strong";
  mono?: boolean;
};

export type ReportCard = {
  key: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent: "blue" | "emerald" | "purple" | "orange" | "rose" | "slate";
  rows: ReportCardRow[];
  footer?: { label: string; value: string | number; tone?: ReportCardRow["tone"] };
};

export type ReportTableColumn = {
  key: string;
  label: string;
  align?: "start" | "center" | "end";
  render?: (row: Record<string, unknown>) => React.ReactNode;
};

export type UniversalReportShellProps = {
  /** optional server-threaded language; the shell's own chrome always uses the `urs.` dictionary */
  langProp?: string | null;
  title: string;
  subtitle?: string;
  /** Location line under the title, e.g. "Quetta Branch, Balochistan, Pakistan" */
  locationLine?: string;
  /** Background image URL for the banner (location-aware). Falls back to a gradient. */
  bannerImage?: string | null;
  /** Small scope badge text, e.g. "Branch Scope" / "Report Scope: Global" */
  scopeBadge?: string;

  reportGroups: ReportOptionGroup[];
  selectedReport: string;
  onSelectReport: (value: string) => void;

  filters: ReportFilterState;
  onFiltersChange: (next: ReportFilterState) => void;
  onApplyFilters: () => void;
  filterOptions: {
    countries: ReportMetaOption[];
    states: ReportMetaOption[];
    cities: ReportMetaOption[];
    branches: ReportMetaOption[];
    statuses: Array<{ value: string; label: string }>;
  };
  /** Which filter controls to show (some reports have no branch/status axis). */
  showFilters?: Partial<Record<keyof ReportFilterState, boolean>>;

  branchUser: BranchUserDetails;
  /** Cards 2–4. Card 1 (Branch & User Details) is rendered by the shell. */
  cards: [ReportCard, ReportCard, ReportCard];

  table: {
    title: string;
    subtitle?: string;
    columns: ReportTableColumn[];
    rows: Array<Record<string, unknown>>;
    totalCount?: number;
    footerRow?: Record<string, unknown>;
  };

  loading?: boolean;
  onRefresh: () => void;
  onExportPdf: () => void;
  onPreviewPdf: () => void;
  onPrint: () => void;
  onExportCsv: () => void;

  /** Optional extra content between the cards and the table (e.g. pagination). */
  belowTable?: React.ReactNode;
};

// ── Accent colour maps ───────────────────────────────────────────────────────

const ACCENT: Record<ReportCard["accent"], { chip: string; icon: string; bar: string }> = {
  blue: { chip: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300", icon: "text-blue-600", bar: "bg-blue-500" },
  emerald: { chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300", icon: "text-emerald-600", bar: "bg-emerald-500" },
  purple: { chip: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300", icon: "text-purple-600", bar: "bg-purple-500" },
  orange: { chip: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300", icon: "text-orange-600", bar: "bg-orange-500" },
  rose: { chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300", icon: "text-rose-600", bar: "bg-rose-500" },
  slate: { chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: "text-slate-500", bar: "bg-slate-500" },
};

function toneClass(tone: ReportCardRow["tone"]) {
  switch (tone) {
    case "positive": return "text-emerald-600 dark:text-emerald-400";
    case "negative": return "text-rose-600 dark:text-rose-400";
    case "muted": return "text-slate-400";
    case "strong": return "text-slate-900 dark:text-slate-50 font-black";
    default: return "text-slate-800 dark:text-slate-100";
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function UniversalReportShell(props: UniversalReportShellProps) {
  const s = useErpScreen("urs", props.langProp);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);
  const [reportQuery, setReportQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const reportMenuRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  // close popovers on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (reportMenuRef.current && !reportMenuRef.current.contains(t)) setReportMenuOpen(false);
      if (filtersRef.current && !filtersRef.current.contains(t)) setFiltersOpen(false);
      if (actionsRef.current && !actionsRef.current.contains(t)) setActionsOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const show = props.showFilters ?? {};
  const wants = (k: keyof ReportFilterState) => show[k] !== false;

  const activeFilterCount = useMemo(() => {
    const f = props.filters;
    let n = 0;
    if (f.dateFrom || f.dateTo) n++;
    if (f.countryId) n++;
    if (f.stateId) n++;
    if (f.cityId) n++;
    if (f.branchId) n++;
    if (f.status) n++;
    return n;
  }, [props.filters]);

  const selectedReportLabel = useMemo(() => {
    for (const g of props.reportGroups) {
      const hit = g.items.find((i) => i.value === props.selectedReport);
      if (hit) return hit.label;
    }
    return s.t("select_report", "Search & Select Report");
  }, [props.reportGroups, props.selectedReport, s]);

  const filteredGroups = useMemo(() => {
    const q = reportQuery.trim().toLowerCase();
    if (!q) return props.reportGroups;
    return props.reportGroups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [props.reportGroups, reportQuery]);

  const setF = (patch: Partial<ReportFilterState>) => props.onFiltersChange({ ...props.filters, ...patch });

  const bud = props.branchUser;
  const budRows: Array<[string, string, string?]> = [
    [s.t("bud_country", "Country"), bud.country],
    [s.t("bud_state", "State / Province"), bud.state],
    [s.t("bud_city", "City"), bud.city],
    [s.t("bud_branch_name", "Branch Name"), bud.branchName],
    [s.t("bud_branch_code", "Branch Code"), bud.branchCode],
    [s.t("bud_user_id", "User ID"), bud.userId],
    [s.t("bud_user_name", "User Name"), bud.userName],
    [s.t("bud_role", "Role"), bud.role, "role"],
    [s.t("bud_scope", "Access Scope"), bud.accessScope],
    [s.t("bud_datetime", "Date & Time"), bud.dateTime],
  ];

  return (
    <div dir={s.dir} className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <div className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:p-4 lg:p-6">

        {/* ── 1. Context banner ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 shadow-sm dark:border-slate-800">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />
          {props.bannerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.bannerImage} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45" />
          ) : null}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/80 via-slate-900/45 to-transparent" />
          <div className="relative flex flex-col gap-3 p-5 text-white sm:p-6 lg:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className={cn("space-y-1", s.textStart)}>
                <h1 className="text-xl font-black tracking-tight sm:text-2xl lg:text-3xl" style={{ textWrap: "balance" } as React.CSSProperties}>
                  {props.title}
                </h1>
                {props.subtitle ? (
                  <p className="text-xs font-semibold text-cyan-200 sm:text-sm">{props.subtitle}</p>
                ) : null}
              </div>
              {props.scopeBadge ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1 text-[11px] font-bold text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {props.scopeBadge}
                </span>
              ) : null}
            </div>
            {props.locationLine ? (
              <p className={cn("flex items-center gap-1.5 text-[11px] font-semibold text-slate-200 sm:text-xs", s.textStart)}>
                <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                <span>{props.locationLine}</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* ── 2. Unified toolbar ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          {/* Search & Select Report */}
          <div ref={reportMenuRef} className="relative min-w-[220px] flex-1">
            <button
              type="button"
              onClick={() => setReportMenuOpen((v) => !v)}
              className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <Search className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              <span className="flex-1 truncate text-start">{selectedReportLabel}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-slate-400 transition", reportMenuOpen && "rotate-180")} />
            </button>
            {reportMenuOpen ? (
              <div className="absolute z-40 mt-1.5 max-h-[60vh] w-full min-w-[260px] overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="relative mb-1.5">
                  <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus
                    value={reportQuery}
                    onChange={(e) => setReportQuery(e.target.value)}
                    placeholder={s.t("search_reports", "Search reports…")}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 ps-8 pe-2 text-xs font-medium outline-none focus:bg-white dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                {filteredGroups.length === 0 ? (
                  <p className="px-2 py-3 text-center text-[11px] text-slate-400">{s.t("no_reports", "No reports match.")}</p>
                ) : filteredGroups.map((g) => (
                  <div key={g.label} className="mb-1">
                    <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{g.label}</p>
                    {g.items.map((it) => (
                      <button
                        key={it.value}
                        type="button"
                        onClick={() => { props.onSelectReport(it.value); setReportMenuOpen(false); setReportQuery(""); }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold",
                          it.value === props.selectedReport
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                        )}
                      >
                        <span className="shrink-0 text-blue-500">{it.icon ?? <FileText className="h-3.5 w-3.5" />}</span>
                        <span className="flex-1 text-start">{it.label}</span>
                        {it.value === props.selectedReport ? <Check className="h-3.5 w-3.5" /> : null}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Filters popover */}
          <div ref={filtersRef} className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold",
                filtersOpen || activeFilterCount > 0
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{s.t("filters", "Filters")}</span>
              {activeFilterCount > 0 ? (
                <span className="ms-0.5 rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">{activeFilterCount}</span>
              ) : null}
            </button>
            {filtersOpen ? (
              <div className="absolute end-0 z-40 mt-1.5 w-[min(92vw,520px)] rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {wants("dateFrom") ? (
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">{s.t("f_date_range", "Date Range")}</label>
                      <ErpDatePicker
                        mode="range"
                        value={{ from: props.filters.dateFrom || null, to: props.filters.dateTo || null }}
                        onChange={(v) => setF({ dateFrom: v.from ?? "", dateTo: v.to ?? "" })}
                        lang={s.lang}
                      />
                    </div>
                  ) : null}
                  {wants("countryId") ? (
                    <FilterSelect label={s.t("f_country", "Country")} value={props.filters.countryId}
                      onChange={(v) => setF({ countryId: v, stateId: "", cityId: "", branchId: "" })}
                      allLabel={s.t("f_all_countries", "All Countries")} options={props.filterOptions.countries} />
                  ) : null}
                  {wants("stateId") ? (
                    <FilterSelect label={s.t("f_state", "State / Province")} value={props.filters.stateId}
                      onChange={(v) => setF({ stateId: v, cityId: "" })}
                      allLabel={s.t("f_all_states", "All States")} options={props.filterOptions.states} />
                  ) : null}
                  {wants("cityId") ? (
                    <FilterSelect label={s.t("f_city", "City")} value={props.filters.cityId}
                      onChange={(v) => setF({ cityId: v })}
                      allLabel={s.t("f_all_cities", "All Cities")} options={props.filterOptions.cities} />
                  ) : null}
                  {wants("branchId") ? (
                    <FilterSelect label={s.t("f_branch", "Branch")} value={props.filters.branchId}
                      onChange={(v) => setF({ branchId: v })}
                      allLabel={s.t("f_all_branches", "All Branches")} options={props.filterOptions.branches} />
                  ) : null}
                  {wants("status") ? (
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">{s.t("f_status", "Status")}</label>
                      <select
                        value={props.filters.status}
                        onChange={(e) => setF({ status: e.target.value })}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                      >
                        <option value="">{s.t("f_all_statuses", "All Statuses")}</option>
                        {props.filterOptions.statuses.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
                      </select>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => { props.onFiltersChange({ dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" }); }}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {s.t("f_reset", "Reset")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { props.onApplyFilters(); setFiltersOpen(false); }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700"
                  >
                    {s.t("f_apply", "Apply Filters")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={props.onRefresh}
            disabled={props.loading}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", props.loading && "animate-spin text-blue-600")} />
            <span className="hidden sm:inline">{s.t("refresh", "Refresh")}</span>
          </button>

          {/* Actions */}
          <div ref={actionsRef} className="relative">
            <button
              type="button"
              onClick={() => setActionsOpen((v) => !v)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-black text-white hover:bg-blue-700"
            >
              <span>{s.t("actions", "Actions")}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {actionsOpen ? (
              <div className="absolute end-0 z-40 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                {[
                  { label: s.t("a_preview_pdf", "PDF Preview"), icon: <Eye className="h-3.5 w-3.5 text-blue-600" />, fn: props.onPreviewPdf },
                  { label: s.t("a_download_pdf", "Download PDF"), icon: <Download className="h-3.5 w-3.5 text-rose-600" />, fn: props.onExportPdf },
                  { label: s.t("a_print", "Print"), icon: <Printer className="h-3.5 w-3.5 text-slate-600" />, fn: props.onPrint },
                  { label: s.t("a_csv", "Export CSV"), icon: <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />, fn: props.onExportCsv },
                ].map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => { a.fn(); setActionsOpen(false); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {a.icon}
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── 3. Four universal cards ───────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {/* Card 1 — Branch & User Details */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2.5">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", ACCENT.blue.chip)}>
                <Building2 className="h-4 w-4" />
              </span>
              <div className={s.textStart}>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  {s.t("card_branch_user", "Branch & User Details")}
                </h3>
              </div>
            </div>
            <dl className="space-y-1.5">
              {budRows.map(([k, v, kind]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 text-[11px]">
                  <dt className="shrink-0 font-bold uppercase tracking-wide text-slate-400 text-[10px]">{k}</dt>
                  <dd className={cn("truncate text-end font-bold", kind === "role" ? "text-blue-600 dark:text-blue-400" : "text-slate-800 dark:text-slate-100")} title={v}>
                    {v || "—"}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">{s.t("bud_status", "Status")}</span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                bud.online ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800",
              )}>
                <span className={cn("h-1.5 w-1.5 rounded-full", bud.online ? "bg-emerald-500" : "bg-slate-400")} />
                {bud.online ? s.t("bud_online", "Online") : s.t("bud_offline", "Offline")}
              </span>
            </div>
          </div>

          {/* Cards 2–4 — module supplied */}
          {props.cards.map((card) => {
            const a = ACCENT[card.accent];
            return (
              <div key={card.key} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", a.chip)}>
                    {card.icon ?? <ClipboardList className="h-4 w-4" />}
                  </span>
                  <div className={s.textStart}>
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{card.title}</h3>
                    {card.subtitle ? <p className="text-[10px] font-medium text-slate-400">{card.subtitle}</p> : null}
                  </div>
                </div>
                <dl className="space-y-1.5">
                  {card.rows.map((r) => (
                    <div key={r.label} className="flex items-baseline justify-between gap-3 text-[11px]">
                      <dt className="shrink-0 font-medium text-slate-500 dark:text-slate-400">{r.label}</dt>
                      <dd className={cn("text-end", r.mono && "font-mono tabular-nums", "font-bold", toneClass(r.tone))}>
                        {typeof r.value === "number" ? r.value.toLocaleString("en-US") : (r.value || "—")}
                      </dd>
                    </div>
                  ))}
                </dl>
                {card.footer ? (
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{card.footer.label}</span>
                    <span className={cn("font-mono text-sm font-black tabular-nums", toneClass(card.footer.tone ?? "strong"))}>
                      {typeof card.footer.value === "number" ? card.footer.value.toLocaleString("en-US") : card.footer.value}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* ── 4. Detailed data table ────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div className={cn("flex items-center gap-2.5", s.textStart)}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                <ClipboardList className="h-3.5 w-3.5" />
              </span>
              <div>
                <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">{props.table.title}</h2>
                {props.table.subtitle ? <p className="text-[10px] font-medium text-slate-400">{props.table.subtitle}</p> : null}
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">
              {s.t("rows_count", "{n} records").replace("{n}", String(props.table.totalCount ?? props.table.rows.length))}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/80">
                  {props.table.columns.map((c) => (
                    <th key={c.key} className={cn("whitespace-nowrap px-3 py-2.5", c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "text-start")}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800">
                {props.loading ? (
                  <tr><td colSpan={props.table.columns.length} className="py-14 text-center text-xs text-slate-400">{s.t("loading", "Loading…")}</td></tr>
                ) : props.table.rows.length === 0 ? (
                  <tr><td colSpan={props.table.columns.length} className="py-14 text-center">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{s.t("no_data", "No data found")}</p>
                    <p className="text-[11px] text-slate-400">{s.t("no_data_hint", "Adjust your filters or date range.")}</p>
                  </td></tr>
                ) : props.table.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20">
                    {props.table.columns.map((c) => (
                      <td key={c.key} className={cn("whitespace-nowrap px-3 py-2", c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "text-start")}>
                        {c.render ? c.render(row) : String(row[c.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                {props.table.footerRow && props.table.rows.length > 0 ? (
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-black dark:border-slate-700 dark:bg-slate-900/60">
                    {props.table.columns.map((c) => (
                      <td key={c.key} className={cn("whitespace-nowrap px-3 py-2.5", c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "text-start")}>
                        {c.render ? c.render(props.table.footerRow!) : String(props.table.footerRow![c.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {props.belowTable}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, allLabel, options,
}: { label: string; value: string; onChange: (v: string) => void; allLabel: string; options: ReportMetaOption[] }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}{o.code ? ` (${o.code})` : ""}</option>
        ))}
      </select>
    </div>
  );
}
