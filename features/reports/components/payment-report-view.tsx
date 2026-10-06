"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Wallet,
  ClipboardList,
  Globe2,
  TrendingUp,
  ShoppingBag,
  Receipt,
  Printer,
  Eye,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Layers,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { ReportContext } from "@/lib/reports/resolve-report-context";
import {
  UniversalReportShell,
  type ReportFilterState,
  type ReportMetaOption,
  type ReportCard,
} from "./universal-report-shell";
import {
  openUniversalReport,
  type UrpColumn,
} from "@/lib/reports/universal-report-print";
import { UnifiedActionMenu } from "@/components/ui/unified-action-menu";
import { SimpleModal } from "@/components/ui/simple-modal";
import { openPaymentVoucherPrintReport } from "@/lib/reports/open-payment-voucher-print";

export type PaymentRow = {
  id: string;
  refNo: string;
  orderNo?: string;
  contractNo?: string | null;
  manualBillNo?: string | null;
  date: string | null;
  flow: "supplier_payment" | "customer_receipt";
  module?: "purchase" | "sales";
  country: string;
  branch: string;
  party: string;
  paymentKind: string;
  currency: string;
  amount: number;
  exchangeRate?: number;
  baseAmount?: number;
  debitLedgerName?: string;
  creditLedgerName?: string;
  narration?: string;
  superAdminSerial?: string | null;
  countrySerial?: string | null;
  branchSerial?: string | null;
  status: string;
  createdBy: string;
  createdAt?: string | null;
};

type PaymentPayload = {
  rows: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: Record<string, number>;
  entriesSummary: Record<string, number>;
  geo: Record<string, number>;
};

const EMPTY_FILTERS: ReportFilterState = {
  dateFrom: "",
  dateTo: "",
  countryId: "",
  stateId: "",
  cityId: "",
  branchId: "",
  status: "",
};

function money(n: number) {
  return (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PaymentReportView({
  context,
  countries,
  branches,
}: {
  context: ReportContext;
  countries: ReportMetaOption[];
  branches: ReportMetaOption[];
}) {
  const s = useErpScreen("payrep");
  const [selectedReport, setSelectedReport] = useState("payment-report");
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<PaymentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedModalRow, setSelectedModalRow] = useState<PaymentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (applied.dateFrom) qs.set("fromDate", applied.dateFrom);
      if (applied.dateTo) qs.set("toDate", applied.dateTo);
      if (applied.countryId) qs.set("countryId", applied.countryId);
      if (applied.branchId) qs.set("cityBranchId", applied.branchId);
      if (applied.status) qs.set("status", applied.status);
      const res = await apiGet<PaymentPayload>(`/api/erp/reports/payments?${qs.toString()}`);
      setData(res);
    } catch {
      setData({ rows: [], total: 0, page: 1, pageSize: 25, summary: {}, entriesSummary: {}, geo: {} });
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { void load(); }, [load]);

  const sum = data?.summary ?? {};
  const ent = data?.entriesSummary ?? {};
  const geo = data?.geo ?? {};

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "financial",
      title: s.t("card_financial", "Payment Financial Summary"),
      subtitle: s.t("card_financial_sub", "Money movement in this scope"),
      icon: <Wallet className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("f_total_records", "Total Payment Records"), value: sum.totalRecords ?? 0, mono: true },
        { label: s.t("f_total_debit", "Total Debit (Paid Out)"), value: money(sum.totalDebit ?? 0), tone: "negative", mono: true },
        { label: s.t("f_total_credit", "Total Credit (Received)"), value: money(sum.totalCredit ?? 0), tone: "positive", mono: true },
        { label: s.t("f_paid", "Paid Amount"), value: money(sum.paidAmount ?? 0), mono: true },
        { label: s.t("f_received", "Received Amount"), value: money(sum.receivedAmount ?? 0), mono: true },
        { label: s.t("f_pending", "Pending Amount"), value: money(sum.pendingAmount ?? 0), tone: "muted", mono: true },
      ],
      footer: { label: s.t("f_remaining", "Remaining Balance"), value: money(sum.remainingBalance ?? 0), tone: "strong" },
    },
    {
      key: "entries",
      title: s.t("card_entries", "Payment Entries Summary"),
      subtitle: s.t("card_entries_sub", "Status breakdown"),
      icon: <ClipboardList className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("e_total", "Total Entries"), value: ent.totalEntries ?? 0, mono: true, tone: "strong" },
        { label: s.t("e_posted", "Posted / Paid"), value: ent.posted ?? 0, tone: "positive", mono: true },
        { label: s.t("e_pending", "Pending"), value: ent.pending ?? 0, mono: true },
        { label: s.t("e_partial", "Partial"), value: ent.partial ?? 0, mono: true },
        { label: s.t("e_draft", "Draft"), value: ent.draft ?? 0, mono: true },
        { label: s.t("e_cancelled", "Cancelled"), value: ent.cancelled ?? 0, tone: "negative", mono: true },
      ],
      footer: { label: s.t("e_supplier_customer", "Supplier / Customer"), value: `${ent.supplierPayments ?? 0} / ${ent.customerReceipts ?? 0}` },
    },
    {
      key: "geo",
      title: s.t("card_geo", "Country / Branch Payment Report"),
      subtitle: s.t("card_geo_sub", "Coverage in this scope"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("g_countries", "Countries"), value: geo.countries ?? 0, mono: true },
        { label: s.t("g_main_branches", "Main Branches"), value: geo.countryBranches ?? 0, mono: true },
        { label: s.t("g_city_branches", "City Branches"), value: geo.cityBranches ?? 0, mono: true },
        { label: s.t("g_users", "Users"), value: geo.users ?? 0, mono: true },
        { label: s.t("g_parties", "Parties"), value: geo.parties ?? 0, mono: true },
      ],
      footer: { label: s.t("g_scoped_total", "Scoped Payment Total"), value: money(geo.scopedPaymentTotal ?? 0), tone: "strong" },
    },
  ], [s, sum, ent, geo]);

  const statusLabel = (st: string) => {
    const map: Record<string, string> = {
      posted: s.t("st_posted", "Posted"),
      cancelled: s.t("st_cancelled", "Cancelled"),
      pending: s.t("st_pending", "Pending"),
      partial: s.t("st_partial", "Partial"),
      draft: s.t("st_draft", "Draft"),
    };
    return map[st.toLowerCase()] ?? st;
  };

  const flowLabel = (f: string) =>
    f === "supplier_payment"
      ? s.t("flow_supplier", "Purchase (Supplier Payment)")
      : s.t("flow_customer", "Sales (Customer Receipt)");

  const kindLabel = (k: string) => {
    const map: Record<string, string> = {
      advance: s.t("kind_advance", "Advance Payment"),
      remaining: s.t("kind_remaining", "Remaining Settlement"),
      booking: s.t("kind_booking", "Order Booking"),
      credit: s.t("kind_credit", "Credit Settlement"),
      receipt: s.t("kind_receipt", "Receipt / Settlement"),
      payment: s.t("kind_payment", "Direct Payment"),
    };
    return map[(k || "").toLowerCase()] ?? (k ? k.toUpperCase() : s.t("kind_payment", "Payment"));
  };

  const handlePrintSingleVoucher = (row: PaymentRow) => {
    openPaymentVoucherPrintReport({
      data: {
        id: row.id,
        refNo: row.refNo,
        orderNo: row.orderNo,
        contractNo: row.contractNo,
        manualBillNo: row.manualBillNo,
        date: row.date,
        flow: row.flow,
        module: row.module,
        country: row.country,
        branch: row.branch,
        party: row.party,
        paymentKind: row.paymentKind,
        currency: row.currency,
        amount: row.amount,
        exchangeRate: row.exchangeRate,
        baseAmount: row.baseAmount,
        debitLedgerName: row.debitLedgerName,
        creditLedgerName: row.creditLedgerName,
        narration: row.narration,
        superAdminSerial: row.superAdminSerial,
        countrySerial: row.countrySerial,
        branchSerial: row.branchSerial,
        status: row.status,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      },
      companyInfo: {
        name: "DIGITAL DOCK ERP",
        branch: context.branchName,
        printedBy: context.userName,
      },
      lang: s.lang,
    });
  };

  const shellColumns = [
    {
      key: "refNo",
      label: s.t("col_ref", "Payment / Ref No"),
      align: "start" as const,
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as PaymentRow;
        const hasDiffOrder = row.orderNo && row.orderNo !== "—" && row.orderNo !== row.refNo;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {row.refNo}
            </span>
            {hasDiffOrder ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                <span
                  className={cn(
                    "rounded px-1 py-0.2 font-semibold",
                    row.flow === "supplier_payment"
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  )}
                >
                  {row.flow === "supplier_payment" ? "PO" : "SO"}: {row.orderNo}
                </span>
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "date",
      label: s.t("col_date", "Date"),
      align: "start" as const,
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as PaymentRow;
        return row.date ? (
          <span className="font-mono text-slate-700 dark:text-slate-300">
            {new Date(String(row.date)).toLocaleDateString("en-GB")}
          </span>
        ) : "—";
      },
    },
    { key: "country", label: s.t("col_country", "Country"), align: "start" as const },
    { key: "branch", label: s.t("col_branch", "Branch"), align: "start" as const },
    {
      key: "party",
      label: s.t("col_party", "Party"),
      align: "start" as const,
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as PaymentRow;
        return (
          <div className="max-w-[200px] truncate font-semibold text-slate-800 dark:text-slate-200" title={row.party}>
            {row.party}
          </div>
        );
      },
    },
    {
      key: "flow",
      label: s.t("col_module", "Category"),
      align: "start" as const,
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as PaymentRow;
        const isSupplier = row.flow === "supplier_payment";
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              isSupplier
                ? "bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
                : "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
            )}
          >
            {isSupplier ? (
              <ShoppingBag className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Receipt className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            )}
            {isSupplier ? s.t("flow_supplier_short", "Purchase") : s.t("flow_customer_short", "Sales")}
          </span>
        );
      },
    },
    {
      key: "paymentKind",
      label: s.t("col_kind", "Payment Nature / Stage"),
      align: "start" as const,
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as PaymentRow;
        const kind = (row.paymentKind || "payment").toLowerCase();
        let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";

        if (kind === "advance") {
          badgeStyle = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
        } else if (kind === "remaining") {
          badgeStyle = "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800";
        } else if (kind === "booking") {
          badgeStyle = "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800";
        } else if (kind === "credit") {
          badgeStyle = "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800";
        } else if (kind === "receipt") {
          badgeStyle = "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800";
        }

        return (
          <div className="flex flex-col gap-0.5">
            <span className={cn("inline-flex w-fit items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border", badgeStyle)}>
              {kindLabel(row.paymentKind)}
            </span>
            {row.narration ? (
              <span className="max-w-[170px] truncate text-[10px] text-slate-500 dark:text-slate-400" title={row.narration}>
                {row.narration}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "currency",
      label: s.t("col_currency", "Currency"),
      align: "center" as const,
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as PaymentRow;
        return (
          <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {row.currency}
          </span>
        );
      },
    },
    {
      key: "amount",
      label: s.t("col_amount", "Amount"),
      align: "end" as const,
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as PaymentRow;
        return (
          <div className="flex flex-col items-end">
            <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
              {money(Number(row.amount))}
            </span>
            {row.exchangeRate && row.exchangeRate !== 1 ? (
              <span className="font-mono text-[9px] text-slate-400" title={`Ex. Rate: ${row.exchangeRate}`}>
                ≈ ${money(Number(row.baseAmount || row.amount))}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "status",
      label: s.t("col_status", "Status"),
      align: "center" as const,
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as PaymentRow;
        const st = String(row.status || "").toLowerCase();
        let badge = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
        if (st === "posted") badge = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
        else if (st === "pending") badge = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
        else if (st === "partial") badge = "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300";
        else if (st === "cancelled") badge = "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300";

        return (
          <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", badge)}>
            {statusLabel(row.status)}
          </span>
        );
      },
    },
    { key: "createdBy", label: s.t("col_created_by", "Created By"), align: "start" as const },
    {
      key: "actions",
      label: s.t("col_actions", "Actions"),
      align: "center" as const,
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as PaymentRow;
        return (
          <div className="flex items-center justify-center">
            <UnifiedActionMenu
              align="right"
              buttonClassName="h-7 w-7 rounded-md p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
              onView={() => setSelectedModalRow(row)}
              onPrint={() => handlePrintSingleVoucher(row)}
            />
          </div>
        );
      },
    },
  ];

  const filterOptions = {
    countries,
    states: [] as ReportMetaOption[],
    cities: [] as ReportMetaOption[],
    branches,
    statuses: [
      { value: "posted", label: s.t("st_posted", "Posted") },
      { value: "pending", label: s.t("st_pending", "Pending") },
      { value: "partial", label: s.t("st_partial", "Partial") },
      { value: "cancelled", label: s.t("st_cancelled", "Cancelled") },
    ],
  };

  // ── PDF / print — feed the SAME data to the shared A4 engine ──
  const buildPrintInput = () => {
    const pdfCols: UrpColumn[] = [
      { key: "refNo", label: s.t("col_ref", "Payment / Ref No") },
      { key: "orderNo", label: s.t("col_order", "Order #") },
      { key: "date", label: s.t("col_date", "Date"), format: "date" },
      { key: "country", label: s.t("col_country", "Country") },
      { key: "branch", label: s.t("col_branch", "Branch") },
      { key: "party", label: s.t("col_party", "Party") },
      { key: "moduleLabel", label: s.t("col_module", "Category") },
      { key: "kindLabel", label: s.t("col_kind", "Payment Nature") },
      { key: "currency", label: s.t("col_currency", "Currency"), align: "center" },
      { key: "amount", label: s.t("col_amount", "Amount"), align: "end", format: "currency" },
      { key: "statusLabel", label: s.t("col_status", "Status"), align: "center" },
      { key: "createdBy", label: s.t("col_created_by", "Created By") },
    ];
    const rows = (data?.rows ?? []).map((r) => ({
      ...r,
      date: r.date ? new Date(r.date).toLocaleDateString("en-GB") : "",
      moduleLabel: r.flow === "supplier_payment" ? "Purchase" : "Sales",
      kindLabel: kindLabel(r.paymentKind),
      statusLabel: statusLabel(r.status),
    }));
    const appliedFilters = [
      applied.dateFrom || applied.dateTo ? { label: s.tGlobal("urs.f_date_range", "Date Range"), value: `${applied.dateFrom || "…"} → ${applied.dateTo || "…"}` } : null,
      applied.countryId ? { label: s.tGlobal("urs.f_country", "Country"), value: countries.find((c) => c.id === applied.countryId)?.name ?? applied.countryId } : null,
      applied.branchId ? { label: s.tGlobal("urs.f_branch", "Branch"), value: branches.find((b) => b.id === applied.branchId)?.name ?? applied.branchId } : null,
      applied.status ? { label: s.tGlobal("urs.f_status", "Status"), value: statusLabel(applied.status) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    return {
      lang: s.lang,
      title: s.t("title", "Payment Report"),
      subtitle: s.t("subtitle", "Track. Reconcile. Keep Business Moving."),
      fileSlug: "payment-report",
      branchUser: {
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId, userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"),
        online: context.online,
      },
      cards: [
        { title: cards[0].title, subtitle: cards[0].subtitle, rows: cards[0].rows.map((r) => ({ ...r })), footer: cards[0].footer },
        { title: cards[1].title, subtitle: cards[1].subtitle, rows: cards[1].rows.map((r) => ({ ...r })), footer: cards[1].footer },
        { title: cards[2].title, subtitle: cards[2].subtitle, rows: cards[2].rows.map((r) => ({ ...r })), footer: cards[2].footer },
      ],
      appliedFilters,
      table: {
        title: s.t("table_title", "Payment Entries"),
        columns: pdfCols,
        rows,
        totals: { amount: (data?.rows ?? []).reduce((a, r) => a + (Number(r.amount) || 0), 0) },
      },
      labels: {
        branchUser: s.tGlobal("urs.card_branch_user", "Branch & User Details"),
        status: s.tGlobal("urs.bud_status", "Status"), online: s.tGlobal("urs.bud_online", "Online"), offline: s.tGlobal("urs.bud_offline", "Offline"),
        country: s.tGlobal("urs.bud_country", "Country"), state: s.tGlobal("urs.bud_state", "State / Province"), city: s.tGlobal("urs.bud_city", "City"),
        branchName: s.tGlobal("urs.bud_branch_name", "Branch Name"), branchCode: s.tGlobal("urs.bud_branch_code", "Branch Code"),
        userId: s.tGlobal("urs.bud_user_id", "User ID"), userName: s.tGlobal("urs.bud_user_name", "User Name"), role: s.tGlobal("urs.bud_role", "Role"),
        accessScope: s.tGlobal("urs.bud_scope", "Access Scope"), dateTime: s.tGlobal("urs.bud_datetime", "Date & Time"),
        generatedOn: s.tGlobal("urs.generated_on", "Generated on"), filtersApplied: s.tGlobal("urs.filters_applied", "Filters Applied"),
        page: s.tGlobal("urs.page", "Page"), of: s.tGlobal("urs.of", "of"),
        billNo: s.tGlobal("urs.bill_no", "Bill No"), manualBillNo: s.tGlobal("urs.manual_bill_no", "Manual Bill No"),
        noData: s.tGlobal("urs.no_data", "No data found"), total: s.tGlobal("urs.total", "Total"),
      },
    };
  };

  const exportCsv = () => {
    const header = [
      s.t("col_ref", "Payment / Ref No"),
      s.t("col_order", "Order #"),
      s.t("col_date", "Date"),
      s.t("col_country", "Country"),
      s.t("col_branch", "Branch"),
      s.t("col_party", "Party"),
      s.t("col_module", "Category"),
      s.t("col_kind", "Payment Nature"),
      s.t("col_currency", "Currency"),
      s.t("col_amount", "Amount"),
      s.t("col_status", "Status"),
      s.t("col_created_by", "Created By"),
    ].join(",");
    const lines = (data?.rows ?? []).map((r) =>
      [
        `"${r.refNo}"`,
        `"${r.orderNo || ""}"`,
        r.date ? new Date(r.date).toLocaleDateString("en-GB") : "",
        `"${r.country}"`,
        `"${r.branch}"`,
        `"${r.party}"`,
        `"${r.flow === "supplier_payment" ? "Purchase" : "Sales"}"`,
        `"${kindLabel(r.paymentKind)}"`,
        r.currency,
        money(r.amount),
        statusLabel(r.status),
        `"${r.createdBy}"`,
      ].join(",")
    );
    const blob = new Blob(["\ufeff" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payment-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const m = selectedModalRow;

  return (
    <>
      <UniversalReportShell
        title={s.t("title", "Payment Report")}
        subtitle={s.t("subtitle", "Track. Reconcile. Keep Business Moving.")}
        locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
        bannerImage={context.bannerImage}
        scopeBadge={context.scopeLabel || context.accessScope}
        reportGroups={[
          {
            label: s.t("grp_payment", "Payment Reports"),
            items: [
              { value: "payment-report", label: s.t("opt_payment_report", "Payment Report") },
              { value: "payment-entries", label: s.t("opt_payment_entries", "Payment Entries") },
              { value: "payment-financial", label: s.t("opt_payment_financial", "Payment Financial Summary") },
            ],
          },
          {
            label: s.t("grp_analytics", "Analytics Reports"),
            items: [
              { value: "country-branch", label: s.t("opt_country_branch", "Country / Branch Report") },
              { value: "paid", label: s.t("opt_paid", "Paid Payments") },
              { value: "pending", label: s.t("opt_pending", "Pending Payments") },
              { value: "user-wise", label: s.t("opt_user_wise", "User-wise Payment Report") },
            ],
          },
        ]}
        selectedReport={selectedReport}
        onSelectReport={setSelectedReport}
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={() => { setPage(1); setApplied(filters); }}
        filterOptions={filterOptions}
        showFilters={{ stateId: false, cityId: false }}
        branchUser={{
          country: context.country, state: context.state, city: context.city,
          branchName: context.branchName, branchCode: context.branchCode,
          userId: context.userId.slice(0, 18), userName: context.userName, role: context.role,
          accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"),
          online: context.online,
        }}
        cards={cards}
        table={{
          title: s.t("table_title", "Payment Entries"),
          subtitle: s.t("table_sub", "Every supplier payment and customer receipt in scope"),
          columns: shellColumns,
          rows: (data?.rows ?? []) as unknown as Array<Record<string, unknown>>,
          totalCount: data?.total ?? 0,
        }}
        loading={loading}
        onRefresh={() => void load()}
        onExportPdf={() => openUniversalReport(buildPrintInput())}
        onPreviewPdf={() => openUniversalReport(buildPrintInput())}
        onPrint={() => openUniversalReport(buildPrintInput())}
        onExportCsv={exportCsv}
      />

      {/* ── Rich Payment Details Modal ── */}
      {m ? (
        <SimpleModal
          isOpen={!!m}
          onClose={() => setSelectedModalRow(null)}
          title={s.t("modal_title", "Payment Transaction Details")}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-5">
            {/* Top Summary Header Card */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-sm dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                        m.flow === "supplier_payment" ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      )}
                    >
                      {m.flow === "supplier_payment" ? "Purchase Payment" : "Customer Receipt"}
                    </span>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                      {kindLabel(m.paymentKind)}
                    </span>
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                      {statusLabel(m.status)}
                    </span>
                  </div>
                  <h3 className="font-mono text-lg font-black tracking-tight text-white sm:text-xl">
                    {m.refNo}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {m.party} &bull; {m.branch} ({m.country})
                  </p>
                </div>

                <div className="text-end">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {s.t("lbl_voucher_amount", "Voucher Amount")}
                  </div>
                  <div className="font-mono text-2xl font-black text-emerald-400 sm:text-3xl">
                    {money(m.amount)} <span className="text-sm text-slate-200">{m.currency}</span>
                  </div>
                  {m.exchangeRate && m.exchangeRate !== 1 ? (
                    <div className="text-[10px] font-medium text-slate-400">
                      Ex. Rate: {m.exchangeRate} &bull; Base: ${money(m.baseAmount || m.amount)} USD
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* 4-Section Information Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Box 1: Transaction & Linked Orders */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:border-slate-800 dark:text-slate-100">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>{s.t("sec_order_link", "Transaction & Order Linkage")}</span>
                </div>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{s.t("lbl_payment_ref", "Payment / Voucher #")}:</dt>
                    <dd className="font-mono font-bold text-slate-900 dark:text-slate-100">{m.refNo}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{s.t("lbl_order_no", "Linked Order #")}:</dt>
                    <dd className="font-mono font-bold text-blue-600 dark:text-blue-400">{m.orderNo || "—"}</dd>
                  </div>
                  {m.contractNo ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400">{s.t("lbl_contract_no", "Contract / Ref #")}:</dt>
                      <dd className="font-mono text-slate-700 dark:text-slate-300">{m.contractNo}</dd>
                    </div>
                  ) : null}
                  {m.manualBillNo ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400">{s.t("lbl_manual_bill", "Manual Bill #")}:</dt>
                      <dd className="font-mono text-slate-700 dark:text-slate-300">{m.manualBillNo}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{s.t("lbl_txn_date", "Transaction Date")}:</dt>
                    <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">
                      {m.date ? new Date(m.date).toLocaleDateString("en-GB") : "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Box 2: Entity & Branch Details */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:border-slate-800 dark:text-slate-100">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <span>{s.t("sec_entity", "Entity & Location")}</span>
                </div>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{s.t("lbl_party_name", "Party (Client / Vendor)")}:</dt>
                    <dd className="font-bold text-slate-900 dark:text-slate-100 text-end">{m.party}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{s.t("lbl_country", "Country")}:</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200">{m.country}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{s.t("lbl_branch", "Branch")}:</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-200 text-end">{m.branch}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">{s.t("lbl_created_by", "Created By")}:</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-300">{m.createdBy}</dd>
                  </div>
                  {m.createdAt ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-400">{s.t("lbl_created_at", "Created Timestamp")}:</dt>
                      <dd className="font-mono text-[11px] text-slate-500">
                        {new Date(m.createdAt).toLocaleString("en-GB")}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              {/* Box 3: Accounting & Ledgers */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50 sm:col-span-2">
                <div className="mb-3 flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:border-slate-800 dark:text-slate-100">
                  <Layers className="h-4 w-4 text-purple-600" />
                  <span>{s.t("sec_accounting", "Accounting Ledgers & Roznamcha Serials")}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                  <div className="flex justify-between rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
                    <span className="font-bold text-slate-500 dark:text-slate-400">{s.t("lbl_debit_ledger", "Debit Ledger")}:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{m.debitLedgerName || "—"}</span>
                  </div>
                  <div className="flex justify-between rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
                    <span className="font-bold text-slate-500 dark:text-slate-400">{s.t("lbl_credit_ledger", "Credit Ledger")}:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{m.creditLedgerName || "—"}</span>
                  </div>
                </div>

                {(m.superAdminSerial || m.countrySerial || m.branchSerial) ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-blue-50/60 p-2.5 text-[11px] font-mono text-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <span className="font-bold">{s.t("lbl_audit_serials", "Audit Serials")}:</span>
                    {m.superAdminSerial ? <span className="rounded bg-white px-1.5 py-0.5 shadow-xs dark:bg-slate-800">SA: {m.superAdminSerial}</span> : null}
                    {m.countrySerial ? <span className="rounded bg-white px-1.5 py-0.5 shadow-xs dark:bg-slate-800">CT: {m.countrySerial}</span> : null}
                    {m.branchSerial ? <span className="rounded bg-white px-1.5 py-0.5 shadow-xs dark:bg-slate-800">BR: {m.branchSerial}</span> : null}
                  </div>
                ) : null}
              </div>

              {/* Box 4: Narration & Particulars ("Kis Cheez Ka Amount Hai") */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 sm:col-span-2">
                <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  <FileText className="h-4 w-4 text-amber-600" />
                  <span>{s.t("sec_narration", "Transaction Purpose & Narration / تفصیلات")}</span>
                </div>
                <p className="text-xs font-medium leading-relaxed text-amber-950 dark:text-amber-100">
                  {m.narration || `${kindLabel(m.paymentKind)} recorded against ${m.orderNo || m.refNo} for party ${m.party}.`}
                </p>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedModalRow(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {s.t("btn_close", "Close")}
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePrintSingleVoucher(m);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-700 transition"
              >
                <Printer className="h-4 w-4" />
                <span>{s.t("btn_print_voucher", "Print Official Voucher (A4)")}</span>
              </button>
            </div>
          </div>
        </SimpleModal>
      ) : null}
    </>
  );
}
