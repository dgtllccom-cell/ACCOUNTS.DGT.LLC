"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Search,
  RefreshCw,
  Plus,
  Eye,
  FileText,
  Printer,
  Truck,
  Ship,
  Landmark,
  Receipt,
  UserCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  Building2,
  User,
  Boxes,
  Scale,
  Sparkles,
  ChevronRight,
  Filter,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  X,
  Copy,
  Check,
  Inbox,
  MessageSquare,
  Send,
  Zap
} from "lucide-react";

import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { useBranchUserContext } from "@/lib/hooks/use-branch-user-context";
import { TaskHandoverModal } from "@/features/transfer-center/components/task-handover-modal";
import { Th } from "@/components/ui/translated-th";

interface OrderLeg {
  id?: string;
  leg_no?: number;
  from_country_name?: string;
  to_country_name?: string;
  transport_mode?: string;
  responsible_clearing_agent_name?: string;
}

interface OrderParty {
  party_type?: string;
  party_customer_name?: string;
  party_company_name?: string;
  selected_address_text?: string;
}

interface CustomerOrder {
  id: string;
  order_no: string;
  created_at: string;
  status: string;
  current_stage?: string;
  customer_id?: string;
  customer_name?: string;
  loading_country_id?: string;
  loading_country_name?: string;
  receiving_country_id?: string;
  receiving_country_name?: string;
  route_name?: string;
  transport_mode?: string;
  movement_type?: string;
  goods_name?: string;
  goods_chs_code?: string;
  goods_variation_label?: string;
  goods_quantity?: number;
  goods_unit?: string;
  goods_gross_weight?: number;
  goods_net_weight?: number;
  goods_empty_weight?: number;
  truck_number?: string;
  truck_driver_name?: string;
  truck_driver_mobile?: string;
  truck_transport_company?: string;
  truck_loading_location?: string;
  truck_registration_type?: string;
  remarks?: string;
  country_id?: string;
  legs?: OrderLeg[];
  party_links?: OrderParty[];
  latest_handover?: {
    id: string;
    status: string;
    receiver_user_id?: string;
    sender_user_id?: string;
  };
}

interface TransferRecord {
  date: string;
  user: string;
  userId?: string;
  branchName?: string;
  destination: string;
  memo?: string;
}

export function CustomerOrderTransferView() {
  const activeLang = useActiveLanguage();
  const lang = (activeLang || "en") as SupportedLanguage;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { context: userContext } = useBranchUserContext();

  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.get("orderId") || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [queueTab, setQueueTab] = useState<"all" | "general_received" | "transferred">("all");
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);

  // User assignment & expense transfer modal state
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<"customs" | "truck" | "customer" | "other" | "clearing_agent" | null>(null);
  
  // Hierarchical scope filter state for modal
  const [filterCountryId, setFilterCountryId] = useState<string>("all");
  const [filterBranchId, setFilterBranchId] = useState<string>("all");
  const [transferUserId, setTransferUserId] = useState<string>("");
  const [transferDate, setTransferDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [transferMemo, setTransferMemo] = useState<string>("");
  const [clearingRoutingStage, setClearingRoutingStage] = useState<string>("customs_clearance");

  // Track transfers and General Received Bills
  const [transferHistory, setTransferHistory] = useState<Record<string, TransferRecord>>({});
  const [generalReceivedOrderIds, setGeneralReceivedOrderIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);

  // Auto-clear toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Auto-clear copied state
  useEffect(() => {
    if (!copiedOrderId) return;
    const timer = setTimeout(() => setCopiedOrderId(null), 2500);
    return () => clearTimeout(timer);
  }, [copiedOrderId]);

  // Load orders and users
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [resOrder, resUsers, resAccounts, resCustomers] = await Promise.all([
        fetch("/api/erp/clearing-agent/customer-order"),
        fetch("/api/erp/users/eligible-assignees").catch(() => null),
        fetch("/api/erp/accounting/accounts?limit=1000").catch(() => null),
        fetch("/api/erp/customers?limit=250").catch(() => null)
      ]);

      const jsonOrder = await resOrder.json();
      if (jsonOrder.success && Array.isArray(jsonOrder.data)) {
        setOrders(jsonOrder.data);
      }

      if (resUsers) {
        const uJson = await resUsers.json().catch(() => null);
        if (uJson?.users && Array.isArray(uJson.users)) {
          setAssignableUsers(uJson.users);
        }
      }

      if (resAccounts) {
        const aJson = await resAccounts.json().catch(() => null);
        if (aJson?.accounts && Array.isArray(aJson.accounts)) {
          setAccounts(aJson.accounts);
        } else if (aJson?.data && Array.isArray(aJson.data)) {
          setAccounts(aJson.data);
        }
      }

      if (resCustomers) {
        const cJson = await resCustomers.json().catch(() => null);
        if (cJson?.customers && Array.isArray(cJson.customers)) {
          setCustomers(cJson.customers);
        } else if (cJson?.data && Array.isArray(cJson.data)) {
          setCustomers(cJson.data);
        }
      }
    } catch (err) {
      console.error("Failed to load customer orders for transfer:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Determine user role hierarchy
  const isSuperAdmin = Boolean(
    userContext?.isSuperAdmin ||
    userContext?.level === "global" ||
    userContext?.role === "super_admin"
  );
  const isCountryAdmin = !isSuperAdmin && (
    userContext?.level === "country" ||
    Boolean(userContext?.role?.includes("country"))
  );
  const isBranchUser = !isSuperAdmin && !isCountryAdmin;

  // Extract available countries for hierarchical selector
  const availableCountries = useMemo(() => {
    const map = new Map<string, string>();
    assignableUsers.forEach((u) => {
      if (u.countryId && u.countryName) {
        map.set(u.countryId, u.countryName);
      }
    });
    if (userContext?.country && !Array.from(map.values()).includes(userContext.country)) {
      map.set("session_country", userContext.country);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [assignableUsers, userContext]);

  // Extract available branches based on country filter
  const availableBranches = useMemo(() => {
    const map = new Map<string, { id: string; name: string; countryId?: string | null }>();
    assignableUsers.forEach((u) => {
      const bId = u.cityBranchId || u.countryBranchId;
      const bName = u.cityBranchName || u.countryBranchName;
      if (bId && bName) {
        if (isSuperAdmin) {
          if (filterCountryId === "all" || u.countryId === filterCountryId) {
            map.set(bId, { id: bId, name: bName, countryId: u.countryId });
          }
        } else if (isCountryAdmin) {
          map.set(bId, { id: bId, name: bName, countryId: u.countryId });
        } else {
          // Branch user
          if (u.cityBranchId === userContext?.branchId || u.countryBranchId === userContext?.branchId) {
            map.set(bId, { id: bId, name: bName, countryId: u.countryId });
          }
        }
      }
    });
    if (userContext?.branchId && userContext?.branchName) {
      if (!map.has(userContext.branchId)) {
        map.set(userContext.branchId, { id: userContext.branchId, name: userContext.branchName });
      }
    }
    return Array.from(map.values());
  }, [assignableUsers, filterCountryId, isSuperAdmin, isCountryAdmin, userContext]);

  // Filter users hierarchically (Super Admin -> Country -> Branch -> User)
  const filteredUsers = useMemo(() => {
    return assignableUsers.filter((u) => {
      if (isSuperAdmin) {
        if (filterCountryId !== "all" && u.countryId && u.countryId !== filterCountryId) {
          return false;
        }
        if (filterBranchId !== "all") {
          const matchBranch = u.cityBranchId === filterBranchId || u.countryBranchId === filterBranchId;
          if (!matchBranch) return false;
        }
        return true;
      }
      if (isCountryAdmin) {
        if (filterBranchId !== "all") {
          const matchBranch = u.cityBranchId === filterBranchId || u.countryBranchId === filterBranchId;
          if (!matchBranch) return false;
        }
        return true;
      }
      // Branch user: strictly own branch
      if (userContext?.branchId) {
        return u.cityBranchId === userContext.branchId || u.countryBranchId === userContext.branchId;
      }
      return true;
    });
  }, [assignableUsers, isSuperAdmin, isCountryAdmin, filterCountryId, filterBranchId, userContext]);

  // GUARANTEE: Responsible User is NEVER BLANK!
  useEffect(() => {
    if (filteredUsers.length > 0) {
      const isCurrentValid = filteredUsers.some((u) => u.id === transferUserId);
      if (!isCurrentValid) {
        const matchSelf = filteredUsers.find((u) => u.id === userContext?.userId);
        setTransferUserId(matchSelf ? matchSelf.id : filteredUsers[0].id);
      }
    } else if (assignableUsers.length > 0 && !transferUserId) {
      setTransferUserId(assignableUsers[0].id);
    }
  }, [filteredUsers, assignableUsers, userContext?.userId, transferUserId]);

  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Filter orders by search, status, mode, and queue tab
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Queue tab filter
      if (queueTab === "general_received") {
        const isGen =
          generalReceivedOrderIds.includes(order.id) ||
          transferHistory[order.id]?.destination?.includes("General Received Bill") ||
          order.current_stage === "general_received_bill";
        if (!isGen) return false;
      } else if (queueTab === "transferred") {
        if (!transferHistory[order.id]) return false;
      }

      // Status filter
      if (statusFilter !== "all" && (order.status || "pending").toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      // Transport mode filter
      if (modeFilter !== "all" && (order.transport_mode || "").toLowerCase() !== modeFilter.toLowerCase()) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const haystack = [
          order.order_no,
          order.customer_name,
          order.goods_name,
          order.truck_number,
          order.truck_driver_name,
          order.loading_country_name,
          order.receiving_country_name,
          order.route_name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, searchQuery, statusFilter, modeFilter, queueTab, generalReceivedOrderIds, transferHistory]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      generalReceived: orders.filter(
        (o) =>
          generalReceivedOrderIds.includes(o.id) ||
          transferHistory[o.id]?.destination?.includes("General Received Bill") ||
          o.current_stage === "general_received_bill"
      ).length,
      transferred: Object.keys(transferHistory).length,
      active: orders.filter((o) =>
        ["in_progress", "booking_confirmed", "confirmed", "1C"].includes(o.status || o.current_stage || "")
      ).length,
      byRoad: orders.filter((o) => (o.transport_mode || "").toLowerCase().includes("road")).length
    };
  }, [orders, generalReceivedOrderIds, transferHistory]);

  // 1-Click Fast Transfer to Clearing Agent ("Tuck! Transfer bhej diya")
  const handleQuickTransferToClearingAgent = (order: CustomerOrder) => {
    const defaultOfficer =
      filteredUsers.find((u) => u.id === transferUserId) ||
      filteredUsers[0] ||
      assignableUsers.find((u) => u.id === userContext?.userId) ||
      assignableUsers[0];

    const officerName = defaultOfficer ? defaultOfficer.name : userContext?.userName || "Clearing Officer";
    const officerBranch = defaultOfficer?.branchName || defaultOfficer?.cityBranchName || userContext?.branchName || "Main Branch";

    // Add to General Received Bills set
    setGeneralReceivedOrderIds((prev) => Array.from(new Set([...prev, order.id])));

    // Update transfer history
    setTransferHistory((prev) => ({
      ...prev,
      [order.id]: {
        date: transferDate || new Date().toISOString().split("T")[0],
        user: officerName,
        userId: defaultOfficer?.id,
        branchName: officerBranch,
        destination: "Clearing Agent (General Received Bill)",
        memo: tt("general_received_memo", "Received in Clearing Agent General Bills desk for onward routing.")
      }
    }));

    // Trigger instant feedback toast
    setToastMessage(
      tt("tuck_transferred_toast", "Tuck! Order {orderNo} transferred to Clearing Agent General Received Bills.").replace("{orderNo}", order.order_no)
    );
  };

  const getStatusBadge = (status: string, stage?: string, orderId?: string) => {
    const isGeneralReceived =
      orderId &&
      (generalReceivedOrderIds.includes(orderId) ||
        transferHistory[orderId]?.destination?.includes("General Received Bill") ||
        stage === "general_received_bill");

    if (isGeneralReceived) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800">
          <Inbox className="h-3 w-3" />
          {tt("status_general_received", "General Received Bill")}
        </span>
      );
    }

    const s = (status || stage || "pending").toLowerCase();
    if (s.includes("completed")) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
          <CheckCircle2 className="h-3 w-3" />
          {tt("status_completed", "Completed")}
        </span>
      );
    }
    if (s.includes("confirm") || s.includes("accepted") || s === "1c") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
          <Clock className="h-3 w-3" />
          {tt("status_confirmed", "Confirmed")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
        <Clock className="h-3 w-3" />
        {status || "Draft"}
      </span>
    );
  };

  const selectedUserObj = useMemo(() => {
    return assignableUsers.find((u) => u.id === transferUserId) || filteredUsers[0] || null;
  }, [assignableUsers, filteredUsers, transferUserId]);

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top-3 flex items-center gap-2.5 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold border border-emerald-400/40">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 hover:bg-emerald-700 rounded-md p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <Link href="/dashboard" className="hover:text-blue-600 transition">
              {tt("nav_dashboard", "Dashboard")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span>{tt("nav_shipping_clearing", "Shipping & Clearing")}</span>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="text-slate-900 dark:text-white font-bold">
              {tt("nav_customer_order_transfer", "Customer Order Transfer")}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <ArrowRightLeft className="h-5 w-5" />
            </span>
            {tt("nav_customer_order_transfer", "Customer Order Transfer")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {tt(
              "order_transfer_subtitle",
              "Transfer, route and manage customer orders across General Received Bills, Customs, Truck, Customer and Other Expense bills"
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-xs transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{tt("refresh", "Refresh")}</span>
          </button>
          <Link
            href="/dashboard/clearing-agent/customer-order"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>{tt("new_order", "New Customer Order")}</span>
          </Link>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {tt("total_orders", "Total Orders")}
            </span>
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats.total}
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-200/80 bg-white p-4 dark:border-cyan-900/50 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              {tt("general_received_bills", "General Received Bills")}
            </span>
            <Inbox className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-600 dark:text-cyan-400">
            {stats.generalReceived}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">
              {tt("transferred_bills_kpi", "Transferred Bills")}
            </span>
            <ArrowRightLeft className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats.transferred}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
              {tt("road_transport", "Road Fleet")}
            </span>
            <Truck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {stats.byRoad}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedOrder ? (
        /* ================= FULL SIZE ORDERS TABLE WITH QUEUE TABS ================= */
        <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/90 shadow-sm overflow-hidden space-y-0">
          {/* Segmented Queue Switcher (All Orders / General Received Bills / Transferred Bills) */}
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 px-4 pt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQueueTab("all")}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                queueTab === "all"
                  ? "border-blue-600 bg-white text-blue-600 dark:bg-slate-900 dark:text-white dark:border-blue-500 shadow-2xs"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{tt("queue_all_orders", "All Customer Orders")}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setQueueTab("general_received")}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                queueTab === "general_received"
                  ? "border-cyan-600 bg-white text-cyan-600 dark:bg-slate-900 dark:text-cyan-400 dark:border-cyan-500 shadow-2xs"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              <Inbox className="h-3.5 w-3.5 text-cyan-500" />
              <span>{tt("queue_general_received", "General Received Bills (Clearing Agent)")}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 font-mono font-bold">
                {stats.generalReceived}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setQueueTab("transferred")}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-xl transition-all border-b-2 cursor-pointer ${
                queueTab === "transferred"
                  ? "border-amber-600 bg-white text-amber-600 dark:bg-slate-900 dark:text-amber-400 dark:border-amber-500 shadow-2xs"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-amber-500" />
              <span>{tt("queue_transferred", "Transferred Expense Bills")}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-mono font-bold">
                {stats.transferred}
              </span>
            </button>
          </div>

          {/* Table Search & Controls Bar */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={tt("search_transfer_placeholder", "Search by order no, customer, route, truck...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 rtl:pl-3 rtl:pr-9 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800/50 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
              >
                <option value="all">{tt("all_statuses", "All Statuses")}</option>
                <option value="draft">{tt("status_draft", "Draft")}</option>
                <option value="confirmed">{tt("status_confirmed", "Confirmed")}</option>
                <option value="completed">{tt("status_completed", "Completed")}</option>
              </select>

              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
              >
                <option value="all">{tt("all_modes", "All Modes")}</option>
                <option value="road">{tt("mode_road", "By Road")}</option>
                <option value="sea">{tt("mode_sea", "By Sea")}</option>
                <option value="air">{tt("mode_air", "By Air")}</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <Th className="py-3 px-4">{tt("order_no", "Order No")}</Th>
                  <Th className="py-3 px-4">{tt("customer", "Customer / Party")}</Th>
                  <Th className="py-3 px-4">{tt("route", "Route (From → To)")}</Th>
                  <Th className="py-3 px-4">{tt("cargo_manifest", "Cargo Manifest")}</Th>
                  <Th className="py-3 px-4">{tt("fleet_driver", "Fleet / Driver")}</Th>
                  <Th className="py-3 px-4">{tt("status_and_routing", "Status & Routing")}</Th>
                  <Th className="py-3 px-4 text-center">{tt("actions", "Actions")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                      <span>{tt("loading_orders", "Loading customer orders...")}</span>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                        {tt("no_orders_found", "No customer orders found")}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {queueTab === "general_received"
                          ? tt("no_general_received_hint", "No orders currently received in Clearing Agent General Received Bills queue.")
                          : tt("create_first_order_hint", "Create a new customer order or transfer to expense bills.")}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const fromLoc = order.loading_country_name || "-";
                    const toLoc = order.receiving_country_name || "-";
                    const cargoWeight = order.goods_gross_weight
                      ? `${Number(order.goods_gross_weight).toLocaleString()} kg`
                      : order.goods_net_weight
                      ? `${Number(order.goods_net_weight).toLocaleString()} kg`
                      : "-";

                    const isGeneralReceived =
                      generalReceivedOrderIds.includes(order.id) ||
                      transferHistory[order.id]?.destination?.includes("General Received Bill") ||
                      order.current_stage === "general_received_bill";

                    const transferRec = transferHistory[order.id];

                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition group"
                      >
                        {/* Order No */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderId(order.id)}
                            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 text-left rtl:text-right cursor-pointer"
                          >
                            {order.order_no}
                          </button>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : "-"}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {order.customer_name || tt("customer_unspecified", "Unspecified Customer")}
                          </div>
                          {order.movement_type ? (
                            <span className="inline-block mt-0.5 text-[10px] uppercase font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {order.movement_type}
                            </span>
                          ) : null}
                        </td>

                        {/* Route */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                            <span>{fromLoc}</span>
                            <ArrowRight className="h-3 w-3 text-slate-400 rtl:rotate-180" />
                            <span>{toLoc}</span>
                          </div>
                          {order.route_name ? (
                            <div className="text-[10px] text-slate-400 mt-0.5">{order.route_name}</div>
                          ) : null}
                        </td>

                        {/* Cargo */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {order.goods_name || tt("general_cargo", "General Cargo")}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {order.goods_quantity ? `${order.goods_quantity} ${order.goods_unit || "pkgs"}` : ""}
                            {cargoWeight !== "-" ? ` • ${cargoWeight}` : ""}
                          </div>
                        </td>

                        {/* Fleet / Truck */}
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {order.truck_number || "-"}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {order.truck_driver_name || "-"}
                            {order.truck_driver_mobile ? ` (${order.truck_driver_mobile})` : ""}
                          </div>
                        </td>

                        {/* Status & Routing */}
                        <td className="py-3 px-4 space-y-1">
                          <div>{getStatusBadge(order.status, order.current_stage, order.id)}</div>
                          {transferRec && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 truncate max-w-[180px]">
                              <span>✓ {transferRec.destination}</span>
                            </div>
                          )}
                        </td>

                        {/* Actions: View & Transfer + 1-Click Tuck Transfer */}
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderId(order.id)}
                              className="inline-flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 text-xs shadow-xs transition cursor-pointer"
                              title={tt("inspect_order_transfer", "Open order transfer workspace")}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>{tt("view_and_transfer", "View & Transfer")}</span>
                            </button>

                            {/* 1-Click Fast Tuck Transfer to Clearing Agent */}
                            {!isGeneralReceived && (
                              <button
                                type="button"
                                onClick={() => handleQuickTransferToClearingAgent(order)}
                                className="inline-flex items-center gap-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-2.5 py-1.5 text-xs shadow-xs transition cursor-pointer"
                                title={tt("quick_transfer_clearing_title", "Tuck! Instant transfer to Clearing Agent General Received Bills")}
                              >
                                <Zap className="h-3.5 w-3.5 text-yellow-300" />
                                <span>{tt("tuck_transfer_btn", "Tuck Transfer")}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= FULL-SIZE DETAIL & TRANSFER VIEW ================= */
        <div className="space-y-6">
          {/* ================= PROMINENT ACTIVE BILL FOR TRANSFER MANIFEST HEADER ================= */}
          {(() => {
            const isGenReceived =
              generalReceivedOrderIds.includes(selectedOrder.id) ||
              transferHistory[selectedOrder.id]?.destination?.includes("General Received Bill") ||
              selectedOrder.current_stage === "general_received_bill";

            const currentTransfer = transferHistory[selectedOrder.id];

            const linkedAccount = accounts.find(
              (a: any) =>
                (selectedOrder.customer_id && a.customer_id === selectedOrder.customer_id) ||
                a.id === selectedOrder.customer_id ||
                (selectedOrder.customer_name && a.name?.toLowerCase() === selectedOrder.customer_name?.toLowerCase())
            );

            const assignedOfficerName =
              currentTransfer?.user ||
              selectedUserObj?.name ||
              userContext?.userName ||
              "Assigned Officer";

            const assignedBranchName =
              currentTransfer?.branchName ||
              selectedUserObj?.branchName ||
              selectedUserObj?.cityBranchName ||
              userContext?.branchName ||
              "Main Branch";

            const activeDate = currentTransfer?.date || transferDate || new Date().toISOString().split("T")[0];

            return (
              <div className="rounded-2xl border-2 border-blue-500/40 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white shadow-xl p-5 md:p-6 space-y-4">
                {/* Top Control Bar: Active Bill Indicator + Serials + Copy + Print + Back */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-750 pb-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(null)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                      <span>{tt("back_to_orders", "Back to Orders")}</span>
                    </button>

                    <div className="h-4 w-px bg-slate-700 hidden sm:block" />

                    {/* Active Bill Glowing Tag */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-black uppercase tracking-wider">
                      <span className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
                      <span>{tt("active_bill_under_transfer", "Active Bill for Transfer")}</span>
                    </div>

                    {/* Order / Bill Number */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xl sm:text-2xl font-black text-white tracking-tight">
                        {selectedOrder.order_no}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedOrder.order_no);
                          setCopiedOrderId(selectedOrder.id);
                        }}
                        className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                        title={tt("copy_order_no", "Copy order number")}
                      >
                        {copiedOrderId === selectedOrder.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Bill Classification Badge */}
                    {isGenReceived ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 px-3 py-0.5 text-xs font-bold">
                        <Inbox className="h-3 w-3" />
                        <span>{tt("general_received_bill_desk", "General Received Bill Desk")}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 px-3 py-0.5 text-xs font-semibold">
                        <FileText className="h-3 w-3" />
                        <span>{tt("customer_commercial_order", "Customer Commercial Order")}</span>
                      </span>
                    )}
                  </div>

                  {/* Right Side: Status Badge & Print Button */}
                  <div className="flex items-center gap-2">
                    {currentTransfer ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{tt("transferred_to_dest", "Transferred")}: {currentTransfer.destination}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{tt("ready_for_transfer", "Ready for Transfer")}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>{tt("print", "Print")}</span>
                    </button>
                  </div>
                </div>

                {/* 4 Sleek High-Contrast Manifest Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                  {/* Card 1: Booking Customer & Chart of Accounts */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3 space-y-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <User className="h-3 w-3 text-blue-400" />
                      <span>{tt("customer_and_ledger", "Customer & Ledger")}</span>
                    </span>
                    <div className="font-bold text-sm text-white truncate">
                      {selectedOrder.customer_name || tt("customer_unspecified", "Unspecified")}
                    </div>
                    <div className="font-mono text-[11px] text-blue-300 truncate">
                      {linkedAccount
                        ? `${linkedAccount.code ? `#${linkedAccount.code} ` : ""}${linkedAccount.name}`
                        : tt("linked_customer_account", "Account: Linked Customer Ledger")}
                    </div>
                  </div>

                  {/* Card 2: Route & Transit Corridor */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3 space-y-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-emerald-400" />
                      <span>{tt("route_corridor", "Transit Corridor")}</span>
                    </span>
                    <div className="font-bold text-sm text-white flex items-center gap-1.5 truncate">
                      <span>{selectedOrder.loading_country_name || "-"}</span>
                      <ArrowRight className="h-3 w-3 text-slate-400 rtl:rotate-180" />
                      <span>{selectedOrder.receiving_country_name || "-"}</span>
                    </div>
                    <div className="text-[11px] text-slate-300 truncate">
                      {selectedOrder.route_name || selectedOrder.transport_mode?.toUpperCase() || "Road Transport Corridor"}
                    </div>
                  </div>

                  {/* Card 3: Cargo Manifest & Gross Weight */}
                  <div className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-3 space-y-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Boxes className="h-3 w-3 text-amber-400" />
                      <span>{tt("cargo_and_weight", "Cargo & Weight")}</span>
                    </span>
                    <div className="font-bold text-sm text-white truncate">
                      {selectedOrder.goods_name || tt("general_cargo", "General Cargo")}
                    </div>
                    <div className="text-[11px] text-amber-300 font-mono font-bold truncate">
                      {selectedOrder.goods_gross_weight
                        ? `${Number(selectedOrder.goods_gross_weight).toLocaleString()} kg`
                        : `${selectedOrder.goods_quantity || "1"} ${selectedOrder.goods_unit || "pkgs"}`}
                      {selectedOrder.goods_chs_code ? ` • HS: ${selectedOrder.goods_chs_code}` : ""}
                    </div>
                  </div>

                  {/* Card 4: Assigned Handler & Branch (NEVER BLANK!) */}
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 space-y-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      <span>{tt("assigned_handler_title", "Assigned Handler & Branch")}</span>
                    </span>
                    <div className="font-bold text-sm text-emerald-200 flex items-center gap-1.5 truncate">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="truncate">{assignedOfficerName}</span>
                    </div>
                    <div className="text-[11px] text-emerald-300/80 truncate">
                      <span>{assignedBranchName}</span> • <span>{activeDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 2-Column Split: LEFT Transfer Destinations Panel, RIGHT Messaging Cards Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ================= LEFT SIDE: EXPENSES & CLEARING AGENT TRANSFER DESTINATIONS (4 Cols) ================= */}
            <div className="lg:col-span-4 space-y-3">
              {/* Instructions Header */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-black text-xs">
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  <span>{tt("transfer_destinations_title", "Transfer Order & Route Expenses")}</span>
                </div>
                <p className="text-[10.5px] text-blue-700/80 dark:text-blue-300/80 mt-0.5 leading-snug">
                  {tt(
                    "transfer_destinations_desc",
                    "Select an expense bill destination to assign an officer and transfer this order."
                  )}
                </p>
              </div>

              {/* If Order is already in General Received Bills: Show Onward Routing Banner */}
              {(() => {
                const isGenReceived =
                  generalReceivedOrderIds.includes(selectedOrder.id) ||
                  transferHistory[selectedOrder.id]?.destination?.includes("General Received Bill") ||
                  selectedOrder.current_stage === "general_received_bill";

                if (isGenReceived) {
                  return (
                    <div className="rounded-xl border-2 border-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 p-3 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-black text-cyan-800 dark:text-cyan-200">
                        <Inbox className="h-4 w-4 text-cyan-600" />
                        <span>{tt("received_in_general_desk_banner", "📥 General Received Bill — Clearing Agent Desk")}</span>
                      </div>
                      <p className="text-[11px] text-cyan-700 dark:text-cyan-300">
                        {tt(
                          "received_routing_guidance",
                          "Bill received by Clearing Agent. Choose where to route it onward below:"
                        )}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Destination 0: Clearing Agent Transfer (General Received Bill) with 1-Click Fast Tuck Transfer */}
              {(() => {
                const isGenReceived =
                  generalReceivedOrderIds.includes(selectedOrder.id) ||
                  transferHistory[selectedOrder.id]?.destination?.includes("General Received Bill") ||
                  selectedOrder.current_stage === "general_received_bill";

                return (
                  <div
                    className={`rounded-xl border p-3 shadow-2xs transition space-y-2 ${
                      isGenReceived
                        ? "border-cyan-400 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/20"
                        : "border-slate-200 bg-white hover:border-cyan-400 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="p-1.5 rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-400 shrink-0">
                          <Inbox className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight truncate">
                            {tt("clearing_agent_general_bill", "Clearing Agent (General Received Bill)")}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {tt("clearing_general_desc", "Route into General Received Bills desk")}
                          </p>
                        </div>
                      </div>

                      {isGenReceived ? (
                        <span className="shrink-0 px-2 py-0.5 rounded text-[10.5px] font-bold bg-cyan-200 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200">
                          ✓ {tt("received_badge", "Received")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickTransferToClearingAgent(selectedOrder)}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-2.5 py-1 text-[11px] shadow-2xs transition cursor-pointer"
                        >
                          <Zap className="h-3 w-3 text-yellow-300" />
                          <span>{tt("tuck_transfer_btn", "Tuck Transfer")}</span>
                        </button>
                      )}
                    </div>

                    {!isGenReceived && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransferTarget("clearing_agent");
                          setTransferModalOpen(true);
                        }}
                        className="w-full text-center text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline pt-1 cursor-pointer"
                      >
                        {tt("configure_officer_transfer", "Configure Handler & Stage Transfer &rarr;")}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Destination 1: Customs Duty & Expenses */}
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs hover:border-amber-400 dark:hover:border-amber-600 transition flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 shrink-0">
                    <Landmark className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight truncate">
                      {tt("customs_expenses_bill", "Customs Bills")}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">
                      {tt("customs_bill_desc", "Tariff clearance & border duty")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTransferTarget("customs");
                    setTransferModalOpen(true);
                  }}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 text-[11px] shadow-2xs transition cursor-pointer"
                >
                  <span>{tt("transfer_btn", "Transfer")}</span>
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </button>
              </div>

              {/* Destination 2: Truck Expenses Bills */}
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs hover:border-blue-400 dark:hover:border-blue-600 transition flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 shrink-0">
                    <Truck className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight truncate">
                      {tt("truck_expenses_bill", "Truck Expenses Bills")}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">
                      {tt("truck_bill_desc", "Freight, tolls & driver advance")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTransferTarget("truck");
                    setTransferModalOpen(true);
                  }}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 text-[11px] shadow-2xs transition cursor-pointer"
                >
                  <span>{tt("transfer_btn", "Transfer")}</span>
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </button>
              </div>

              {/* Destination 3: Customer Expenses Bills */}
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs hover:border-emerald-400 dark:hover:border-emerald-600 transition flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 shrink-0">
                    <Receipt className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight truncate">
                      {tt("customer_expenses_bill", "Customer Expenses Bills")}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">
                      {tt("customer_bill_desc", "Direct client disbursements")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTransferTarget("customer");
                    setTransferModalOpen(true);
                  }}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 text-[11px] shadow-2xs transition cursor-pointer"
                >
                  <span>{tt("transfer_btn", "Transfer")}</span>
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </button>
              </div>

              {/* Destination 4: Other Expenses Bills */}
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 shadow-2xs hover:border-purple-400 dark:hover:border-purple-600 transition flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 shrink-0">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight truncate">
                      {tt("other_expenses_bill", "Other Expenses Bills")}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate">
                      {tt("other_bill_desc", "Inspection, lab, seals & fees")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTransferTarget("other");
                    setTransferModalOpen(true);
                  }}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold px-2.5 py-1 text-[11px] shadow-2xs transition cursor-pointer"
                >
                  <span>{tt("transfer_btn", "Transfer")}</span>
                  <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                </button>
              </div>

              {/* Additional Operations: Handover & Official Customer Invoice */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => setHandoverModalOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold py-1.5 text-xs transition cursor-pointer"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>{tt("assign_handover_order", "Assign / Handover to User")}</span>
                </button>

                <Link
                  href={`/dashboard/clearing-agent/customer-bill?new=true&orderId=${selectedOrder.id}&customerId=${selectedOrder.customer_id || ""}`}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 font-bold py-1.5 text-xs transition"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>{tt("create_customer_invoice", "Create Customer Invoice")}</span>
                </Link>
              </div>
            </div>

            {/* ================= RIGHT SIDE: 6 STRUCTURED MESSAGING / DISPATCH CARDS (8 Cols) ================= */}
            <div className="lg:col-span-8 space-y-4">
              {/* MESSAGE CARD 1: 💼 Commercial & Accounts Ledger Message */}
              {(() => {
                const linkedAccount = accounts.find(
                  (a: any) =>
                    (selectedOrder.customer_id && a.customer_id === selectedOrder.customer_id) ||
                    a.id === selectedOrder.customer_id ||
                    (selectedOrder.customer_name && a.name?.toLowerCase() === selectedOrder.customer_name?.toLowerCase())
                );
                const custInfo = customers.find(
                  (c: any) =>
                    c.id === selectedOrder.customer_id ||
                    c.name?.toLowerCase() === selectedOrder.customer_name?.toLowerCase()
                );

                return (
                  <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
                          💼
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{tt("commercial_accounts_desk", "Commercial & Financial Ledger Desk")}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              Verified
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleDateString() : "Active Record"}
                          </span>
                        </div>
                      </div>
                      {custInfo?.code && (
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded">
                          Cust: {custInfo.code}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          {tt("customer_name", "Customer / Booking Party")}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                          {selectedOrder.customer_name || custInfo?.name || "-"}
                        </span>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          {tt("account_ledger", "Accounting Ledger")}
                        </span>
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5 block truncate">
                          {linkedAccount
                            ? `${linkedAccount.code ? `#${linkedAccount.code} ` : ""}${linkedAccount.name}`
                            : tt("pending_ledger_assignment", "Pending Ledger Link")}
                        </span>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          {tt("contact_and_phone", "Contact & Mobile")}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 mt-0.5 block truncate">
                          {custInfo?.phone || custInfo?.mobile || custInfo?.email || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* MESSAGE CARD 2: 🧭 Route & Geographic Corridor Message */}
              <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                      🧭
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{tt("transit_route_desk", "Transit Logistics & Corridor Desk")}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          {selectedOrder.movement_type || "TRANSIT"}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {tt("origin_destination_tracking", "Origin to Destination Route Tracking")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      {tt("origin_country_loading", "Loading Location / Origin")}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                      {selectedOrder.loading_country_name || "-"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      {tt("destination_country_border", "Discharge / Receiving Border")}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                      {selectedOrder.receiving_country_name || "-"}
                    </span>
                  </div>
                </div>

                {selectedOrder.route_name && (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-600 dark:text-slate-300">
                    <strong>{tt("corridor_path", "Corridor Path")}: </strong>
                    <span>{selectedOrder.route_name}</span>
                  </div>
                )}
              </div>

              {/* MESSAGE CARD 3: 📦 Goods & Cargo Manifest Message */}
              <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center font-bold text-sm">
                      📦
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{tt("cargo_manifest_desk", "Cargo Manifest & Customs Classification")}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Declared Goods
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {tt("weight_and_quantity_specs", "Weight & Quantity Specifications")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("item_name", "Item Name")}</span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                      {selectedOrder.goods_name || "-"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("chs_code", "CHS / HS Code")}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
                      {selectedOrder.goods_chs_code || "-"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("quantity", "Quantity")}</span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                      {selectedOrder.goods_quantity ? `${selectedOrder.goods_quantity} ${selectedOrder.goods_unit || ""}` : "-"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("gross_weight", "Gross Weight")}</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 block">
                      {selectedOrder.goods_gross_weight ? `${Number(selectedOrder.goods_gross_weight).toLocaleString()} kg` : "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* MESSAGE CARD 4: 🚛 Fleet & Haulier Dispatch Message */}
              <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                      🚛
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{tt("fleet_haulier_desk", "Transport Operations & Vehicle Dispatch")}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          Road Freight
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {tt("vehicle_and_driver_record", "Driver, Vehicle & Transporter Assignment")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("truck_no", "Truck No")}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
                      {selectedOrder.truck_number || "-"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("driver_name", "Driver Name")}</span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                      {selectedOrder.truck_driver_name || "-"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("driver_mobile", "Driver Contact")}</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 block">
                      {selectedOrder.truck_driver_mobile || "-"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-850/50">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">{tt("transport_co", "Transporter")}</span>
                    <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                      {selectedOrder.truck_transport_company || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* MESSAGE CARD 5: 💬 Operational Instructions & Special Remarks */}
              {selectedOrder.remarks && (
                <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm p-4 space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="h-7 w-7 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center font-bold text-xs">
                      💬
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {tt("operational_remarks_desk", "Clearing Agent Operational Remarks & Client Notes")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed pl-2">
                    {selectedOrder.remarks}
                  </p>
                </div>
              )}

              {/* MESSAGE CARD 6: 🔄 Transfer History & Handover Audit Trail */}
              {(() => {
                const currentTransfer = transferHistory[selectedOrder.id];
                return (
                  <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300 flex items-center justify-center font-bold text-sm">
                          🔄
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{tt("transfer_audit_registry", "Order Transfer Registry & Audit Log")}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                              Audit Trail
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {tt("transfer_audit_desc", "Track all transfers, officers assigned, and expense destinations")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {currentTransfer ? (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span>{currentTransfer.destination}</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{currentTransfer.date}</span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300">
                          {tt("assigned_officer_lbl", "Assigned Officer")}: <strong>{currentTransfer.user}</strong>
                          {currentTransfer.branchName ? ` (${currentTransfer.branchName})` : ""}
                        </div>
                        {currentTransfer.memo && (
                          <div className="text-[11px] text-slate-500 italic">
                            "{currentTransfer.memo}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50/60 dark:bg-slate-850/60 text-xs text-slate-400 text-center">
                        {tt("no_prior_transfers", "No prior transfer records logged for this order. Ready to route above.")}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ================= SCOPED HIERARCHICAL USER ASSIGNMENT & TRANSFER MODAL ================= */}
      {transferModalOpen && selectedOrder && transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                  <ArrowRightLeft className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {transferTarget === "clearing_agent"
                    ? tt("clearing_general_transfer_title", "Clearing Agent General Transfer Form")
                    : `${tt("transfer_to_prefix", "Transfer Order to")} ${
                        transferTarget === "customs"
                          ? tt("customs_expenses_bill", "Customs Bill")
                          : transferTarget === "truck"
                          ? tt("truck_expenses_bill", "Truck Expenses Bill")
                          : transferTarget === "customer"
                          ? tt("customer_expenses_bill", "Customer Expenses Bill")
                          : tt("other_expenses_bill", "Other Expenses Bill")
                      }`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Selected Order Summary Card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                  {selectedOrder.order_no}
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  {selectedOrder.customer_name || "Customer"}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span>
                  {tt("route", "Route")}: {selectedOrder.loading_country_name || "-"} → {selectedOrder.receiving_country_name || "-"}
                </span>
                <span>
                  {tt("cargo", "Cargo")}: {selectedOrder.goods_name || "General Cargo"}
                </span>
              </div>
            </div>

            {/* Form Fields: SCOPED HIERARCHY */}
            <div className="space-y-3.5 text-xs">
              {/* STEP 1 & 2: Country and Branch Selectors (Scoped by User Role) */}
              {isSuperAdmin ? (
                /* Super Admin: Can select Country, then Branch */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                      {tt("step_country_superadmin", "1. Country Scope (Super Admin)")}
                    </label>
                    <select
                      value={filterCountryId}
                      onChange={(e) => {
                        setFilterCountryId(e.target.value);
                        setFilterBranchId("all");
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">{tt("all_countries_opt", "All Countries")}</option>
                      {availableCountries.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                      {tt("step_branch_superadmin", "2. Branch Scope")}
                    </label>
                    <select
                      value={filterBranchId}
                      onChange={(e) => setFilterBranchId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">{tt("all_branches_opt", "All Branches")}</option>
                      {availableBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : isCountryAdmin ? (
                /* Country Admin: Country fixed, selects Branch */
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <span className="font-bold">{tt("country_scope_fixed", "Country Scope")}:</span>
                    <span className="font-semibold">{userContext?.country || "Current Country"}</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                      {tt("select_branch_countryadmin", "Select Branch Scope")}
                    </label>
                    <select
                      value={filterBranchId}
                      onChange={(e) => setFilterBranchId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="all">{tt("all_country_branches", "All Branches in Country")}</option>
                      {availableBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                /* Branch User: Locked to Own Branch */
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">{tt("branch_scope_locked", "Branch Scope")}:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {userContext?.branchName || "My Branch"}
                  </span>
                </div>
              )}

              {/* STEP 3: Assign to User Dropdown (NEVER BLANK!) */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                  {tt("assign_responsible_user", "Select Responsible Officer *")}
                </label>
                <select
                  value={transferUserId}
                  onChange={(e) => setTransferUserId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
                >
                  {filteredUsers.length === 0 ? (
                    <option value="">{tt("no_users_in_branch", "No users in selected branch")}</option>
                  ) : (
                    filteredUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.fullName || u.full_name || u.email} {u.role ? `(${u.role})` : ""}{" "}
                        {u.cityBranchName || u.countryBranchName ? `[${u.cityBranchName || u.countryBranchName}]` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Selected Officer Preview Card */}
              {selectedUserObj && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20 text-xs">
                  <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {selectedUserObj.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="truncate">{selectedUserObj.name}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                      <span>{selectedUserObj.role || "Officer"}</span>
                      <span>•</span>
                      <span>
                        {selectedUserObj.branchName ||
                          selectedUserObj.cityBranchName ||
                          selectedUserObj.countryBranchName ||
                          userContext?.branchName ||
                          "Branch"}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 shrink-0">
                    {tt("assigned_badge", "Active Assignee")}
                  </span>
                </div>
              )}

              {/* Transfer Date */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                  {tt("transfer_date_label", "Transfer Date *")}
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              {/* If Clearing Agent: Routing Stage Option */}
              {transferTarget === "clearing_agent" && (
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                    {tt("clearing_routing_stage", "Clearing Agent Routing Stage")}
                  </label>
                  <select
                    value={clearingRoutingStage}
                    onChange={(e) => setClearingRoutingStage(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="customs_clearance">🏛️ Customs Clearance & Border Duty</option>
                    <option value="general_received_bill">📥 General Received Bill Queue</option>
                    <option value="warehouse_transfer">🏢 Warehouse Storage & Transfer</option>
                    <option value="truck_dispatch">🚚 Truck Haulage & Road Dispatch</option>
                    <option value="shipping_pipeline">🚢 Full Shipping Clearing Pipeline</option>
                  </select>
                </div>
              )}

              {/* Transfer Memo */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 mb-1">
                  {tt("transfer_memo_label", "Transfer Memo / Operational Instructions")}
                </label>
                <textarea
                  rows={2}
                  value={transferMemo}
                  onChange={(e) => setTransferMemo(e.target.value)}
                  placeholder={tt(
                    "transfer_memo_placeholder",
                    "Enter specific notes, duty tariff numbers, or handling remarks..."
                  )}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {tt("btn_cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetUser =
                    filteredUsers.find((u) => u.id === transferUserId) ||
                    assignableUsers.find((u) => u.id === transferUserId);
                  const userName = targetUser
                    ? targetUser.name || targetUser.fullName || targetUser.full_name
                    : userContext?.userName || "Assigned Officer";
                  const branchName =
                    targetUser?.branchName ||
                    targetUser?.cityBranchName ||
                    userContext?.branchName ||
                    "Main Branch";

                  // Mark in General Received Bills if clearing agent
                  if (transferTarget === "clearing_agent") {
                    setGeneralReceivedOrderIds((prev) => Array.from(new Set([...prev, selectedOrder.id])));
                  }

                  // Record transfer log
                  setTransferHistory((prev) => ({
                    ...prev,
                    [selectedOrder.id]: {
                      date: transferDate,
                      user: userName,
                      userId: transferUserId,
                      branchName,
                      destination:
                        transferTarget === "clearing_agent"
                          ? `Clearing Agent (General Received Bill)`
                          : `${transferTarget?.toUpperCase()} Bill`,
                      memo: transferMemo
                    }
                  }));

                  setToastMessage(
                    tt("order_transferred_toast", "Order {orderNo} successfully transferred to {dest}.").replace(
                      "{orderNo}",
                      selectedOrder.order_no
                    ).replace("{dest}", transferTarget?.toUpperCase() || "")
                  );

                  setTransferModalOpen(false);

                  // Navigate to destination if requested
                  if (transferTarget === "customs") {
                    router.push(
                      `/dashboard/clearing-agent/customs-expenses?orderId=${selectedOrder.id}&orderNo=${encodeURIComponent(
                        selectedOrder.order_no
                      )}&customerId=${selectedOrder.customer_id || ""}&assignedUserId=${transferUserId}&date=${transferDate}`
                    );
                  } else if (transferTarget === "truck") {
                    router.push(
                      `/dashboard/clearing-agent/truck-expenses?orderId=${selectedOrder.id}&orderNo=${encodeURIComponent(
                        selectedOrder.order_no
                      )}&truckNo=${encodeURIComponent(selectedOrder.truck_number || "")}&driver=${encodeURIComponent(
                        selectedOrder.truck_driver_name || ""
                      )}&assignedUserId=${transferUserId}&date=${transferDate}`
                    );
                  } else if (transferTarget === "customer") {
                    router.push(
                      `/dashboard/clearing-agent/customer-bill?type=expenses&orderId=${selectedOrder.id}&orderNo=${encodeURIComponent(
                        selectedOrder.order_no
                      )}&customerId=${selectedOrder.customer_id || ""}&assignedUserId=${transferUserId}&date=${transferDate}`
                    );
                  } else if (transferTarget === "other") {
                    router.push(
                      `/dashboard/clearing-agent/other-expenses?orderId=${selectedOrder.id}&orderNo=${encodeURIComponent(
                        selectedOrder.order_no
                      )}&assignedUserId=${transferUserId}&date=${transferDate}`
                    );
                  }
                }}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{tt("confirm_and_proceed", "Confirm & Proceed")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Handover Modal */}
      {handoverModalOpen && selectedOrder ? (
        <TaskHandoverModal
          open={handoverModalOpen}
          onClose={() => setHandoverModalOpen(false)}
          orderReference={selectedOrder.order_no}
          sourceTable="clearing_customer_orders"
          sourceId={selectedOrder.id}
          targetUrl={`/dashboard/clearing-agent/order-transfer?orderId=${selectedOrder.id}`}
          defaultTask={tt(
            "handover_transfer_task",
            "Please review and process expense transfers for customer order {orderNo}."
          ).replace("{orderNo}", selectedOrder.order_no)}
          sourceCountryId={selectedOrder.country_id || selectedOrder.loading_country_id || null}
          domain="business"
          onSuccess={() => {
            setHandoverModalOpen(false);
            fetchOrders();
          }}
          lang={lang}
        />
      ) : null}
    </div>
  );
}
