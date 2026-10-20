"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  RefreshCcw,
  Search,
  Receipt,
  ArrowLeft,
  ArrowRight,
  FileText,
  Truck,
  Eye,
  CheckCircle2,
  Clock,
  Building2,
  DollarSign,
  Filter,
  SlidersHorizontal,
  ExternalLink,
  Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Th } from "@/components/ui/translated-th";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { IntakeDraftPicker } from "@/features/document-intelligence/components/intake-draft-picker";
import { CustomerOrderTransferHubView } from "./customer-order-transfer-hub-view";
import { CustomerBillManagementView } from "./customer-bill-management-view";
import type { CustomerBillRow } from "@/lib/services/clearing-customer-bill-service";
import { coModeLabel, coMovementLabel, coStatusLabel } from "./customer-order-i18n";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200",
  approved: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200",
  posted: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200",
};

export function CustomerBillRegister({ lang: langProp }: { lang?: SupportedLanguage }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const s = useErpScreen("cbill", langProp);
  const lang = s.lang;
  const dir = s.dir;
  const _ = (key: string, fallback: string) => s.tGlobal(key, fallback);

  // Read URL params
  const urlId = searchParams.get("id") || searchParams.get("orderId");
  const editModeParam = searchParams.get("mode") === "edit";

  const [rows, setRows] = useState<CustomerBillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(urlId);
  const [openBillManagementId, setOpenBillManagementId] = useState<string | null>(editModeParam ? urlId : null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp/clearing-agent/customer-bill?limit=100", { cache: "no-store" });
      const json = await res.json();
      setRows(json.success && Array.isArray(json.data) ? json.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  // Keep state synced with URL id
  useEffect(() => {
    if (urlId) {
      if (editModeParam) {
        setOpenBillManagementId(urlId);
        setActiveOrderId(null);
      } else {
        setActiveOrderId(urlId);
        setOpenBillManagementId(null);
      }
    } else {
      setActiveOrderId(null);
      setOpenBillManagementId(null);
    }
  }, [urlId, editModeParam]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (modeFilter !== "all" && r.transport_mode !== modeFilter && r.movement_type !== modeFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        (r.bill_no || "").toLowerCase().includes(q) ||
        (r.customer_name || "").toLowerCase().includes(q) ||
        (r.order_no || "").toLowerCase().includes(q) ||
        (r.truck_number || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter, modeFilter]);

  // KPI Statistics
  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => ["paid", "posted", "completed", "approved"].includes(r.status)).length;
    const draft = rows.filter((r) => r.status === "draft").length;
    const submitted = rows.filter((r) => ["submitted", "in_progress"].includes(r.status)).length;
    const totalGrand = rows.reduce((sum, r) => sum + Number(r.grand_total || 0), 0);
    return { total, completed, draft, submitted, totalGrand };
  }, [rows]);

  // Print/export rows carry the localized enum labels (not the raw by_road / draft codes).
  const printRows = useMemo(
    () =>
      filteredRows.map((r) => ({
        ...r,
        transport_mode: coModeLabel(lang, r.transport_mode),
        movement_type: coMovementLabel(lang, r.movement_type),
        status: coStatusLabel(lang, r.status),
      })) as unknown as Record<string, unknown>[],
    [filteredRows, lang]
  );

  // If in edit / charges management mode
  if (openBillManagementId) {
    return (
      <div dir={dir} className="space-y-3 p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => {
            setOpenBillManagementId(null);
            router.replace(activeOrderId ? `/dashboard/clearing-agent/customer-bill?id=${activeOrderId}` : "/dashboard/clearing-agent/customer-bill");
            void loadRows();
          }}
        >
          <ArrowLeft className="me-1.5 h-3.5 w-3.5 rtl:rotate-180" />
          {s.t("reg_back", "Back to Customer Order & Bill")}
        </Button>
        <CustomerBillManagementView initialBillId={openBillManagementId} />
      </div>
    );
  }

  // If an order / bill is selected for the Transfer Hub View
  if (activeOrderId) {
    return (
      <div dir={dir}>
        <CustomerOrderTransferHubView
          orderId={activeOrderId}
          lang={lang}
          onBack={() => {
            setActiveOrderId(null);
            router.replace("/dashboard/clearing-agent/customer-bill");
            void loadRows();
          }}
        />
      </div>
    );
  }

  // Otherwise show the Smart Customer Bill & Order Register Table
  return (
    <div dir={dir} className="mx-auto max-w-[1720px] space-y-4 p-3 sm:p-5">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#0b5394] text-white shadow-md shadow-blue-900/15">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {_("cbill.register_title", "Customer Bill & Order Register")}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {s.t("reg_subtitle", "Central clearing agent billing, orders, and multi-expense transfer desk")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-bold"
            onClick={() => void loadRows()}
            disabled={loading}
          >
            <RefreshCcw className={`me-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {_("common.refresh", "Refresh")}
          </Button>

          <IntakeDraftPicker
            targetModule="clearing_customer_bills"
            domain="shipping"
            lang={lang}
            onPicked={() => {
              setOpenBillManagementId("new");
            }}
          />

          <Button
            type="button"
            size="sm"
            className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20"
            onClick={() => {
              router.push("/dashboard/clearing-agent/customer-order");
            }}
          >
            <Plus className="me-1.5 h-4 w-4" />
            {s.t("reg_new_order", "New Customer Order")}
          </Button>
        </div>
      </div>

      {/* Smart KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
            <span>{s.t("reg_kpi_total", "Total Orders & Bills")}</span>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {s.t("reg_kpi_total_sub", "Active clearing & commercial records")}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200/90 bg-white p-4 dark:border-emerald-900/50 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>{s.t("reg_kpi_completed", "Completed / Settled")}</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.completed}
          </div>
          <div className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
            {s.t("reg_kpi_completed_sub", "Transferred and fully processed")}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200/90 bg-white p-4 dark:border-blue-900/50 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
            <span>{s.t("reg_kpi_active", "In Process / Active")}</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400">
            {stats.submitted}
          </div>
          <div className="text-[11px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">
            {s.t("reg_kpi_active_sub", "Under customs or inland transit")}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/90 bg-white p-4 dark:border-amber-900/50 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
            <span>{s.t("reg_kpi_draft", "Draft / Pending")}</span>
            <SlidersHorizontal className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats.draft}
          </div>
          <div className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">
            {s.t("reg_kpi_draft_sub", "Awaiting final documentation")}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.t("reg_search_ph", "Search by Bill No, Customer, Order No, Truck...")}
              className="h-9.5 ps-9 text-xs rounded-xl bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="all">{s.t("reg_all_statuses", "All Statuses")}</option>
              <option value="completed">{s.t("reg_st_completed", "Completed / Paid")}</option>
              <option value="submitted">{s.t("reg_st_submitted", "Submitted / In Process")}</option>
              <option value="draft">{_("com.status_draft", "Draft")}</option>
            </select>

            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="all">{s.t("reg_all_modes", "All Modes")}</option>
              <option value="by_road">{_("com.mode_by_road", "By Road")}</option>
              <option value="by_sea">{_("com.mode_by_sea", "By Sea")}</option>
              <option value="by_air">{_("com.mode_by_air", "By Air")}</option>
              <option value="transit">{_("com.mv_transit", "Transit")}</option>
              <option value="import">{_("com.mv_import", "Import")}</option>
            </select>

            <JournalPrintButton
              title={_("cbill.register_title", "Customer Bill & Order Register")}
              columns={[
                { key: "bill_no", label: _("cod.bill_no", "Bill No."), align: "center" },
                { key: "order_no", label: _("cod.order_no", "Order No."), align: "center" },
                { key: "customer_name", label: s.t("reg_col_customer", "Customer") },
                { key: "transport_mode", label: _("cbill.transport_mode", "Transport Mode"), align: "center" },
                { key: "movement_type", label: _("cbill.movement_type", "Movement Type"), align: "center" },
                { key: "grand_total", label: _("cbill.grand_total", "Grand Total"), align: "right", format: "number" },
                { key: "status", label: _("common.status", "Status"), align: "center" }
              ]}
              rows={printRows}
              orientation="landscape"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-[#f1f5f9] dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3.5">{_("cod.bill_no", "Bill No.")}</th>
                  <th className="py-3 px-3.5">{_("cod.order_no", "Order No.")}</th>
                  <th className="py-3 px-3.5">{s.t("reg_col_customer_ledger", "Customer & Ledger")}</th>
                  <th className="py-3 px-3.5">{s.t("reg_col_route_mode", "Route & Mode")}</th>
                  <th className="py-3 px-3.5 text-end">{_("cbill.grand_total", "Grand Total")}</th>
                  <th className="py-3 px-3.5 text-center">{_("common.status", "Status")}</th>
                  <th className="py-3 px-3.5 text-center">{_("common.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11.5px]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCcw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                      <span>{s.t("reg_loading", "Loading customer orders and bills...")}</span>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        {s.t("reg_empty_title", "No customer bills or orders found")}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {s.t("reg_empty_sub", "Select a customer order or create a new one to open the transfer hub.")}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => {
                    const targetId = r.order_id || r.id;
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-blue-50/50 dark:hover:bg-slate-800/40 transition group cursor-pointer"
                        onClick={() => {
                          setActiveOrderId(targetId);
                          router.push(`/dashboard/clearing-agent/customer-bill?id=${targetId}`);
                        }}
                      >
                        {/* Bill No */}
                        <td className="py-3 px-3.5">
                          <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                            {r.bill_no || "CB-PENDING"}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {r.bill_date ? new Date(r.bill_date).toLocaleDateString() : "-"}
                          </div>
                        </td>

                        {/* Order No */}
                        <td className="py-3 px-3.5">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            {r.order_no || "CL-ORD-PENDING"}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {r.customer_name || s.t("reg_unspecified_customer", "Unspecified Customer")}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            {r.customer_account_number || s.t("reg_linked_ledger", "A/C: Linked Ledger")}
                          </div>
                        </td>

                        {/* Route & Mode */}
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-slate-700 dark:text-slate-300">
                            {r.transport_mode ? coModeLabel(lang, r.transport_mode) : s.t("reg_road_corridor", "Road Corridor")}
                          </div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                            {r.movement_type ? coMovementLabel(lang, r.movement_type) : _("com.mv_transit", "Transit")}
                          </div>
                        </td>

                        {/* Grand Total */}
                        <td className="py-3 px-3.5 text-end font-mono font-black text-slate-900 dark:text-white">
                          {Number(r.grand_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {r.currency_code || "USD"}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3.5 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              STATUS_STYLES[r.status] || STATUS_STYLES.draft
                            }`}
                          >
                            {coStatusLabel(lang, r.status)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveOrderId(targetId);
                                router.push(`/dashboard/clearing-agent/customer-bill?id=${targetId}`);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                              title={s.t("reg_open_hub_title", "Open Customer Order & Transfer Hub")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>{s.t("reg_open_hub", "View / Transfer Hub")}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenBillManagementId(r.id);
                                router.push(`/dashboard/clearing-agent/customer-bill?id=${r.id}&mode=edit`);
                              }}
                              className="inline-flex items-center p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              title={s.t("reg_edit_charges", "Edit Bill Charges")}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
