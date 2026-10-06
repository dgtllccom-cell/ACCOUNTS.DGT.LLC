"use client";

import { pl } from "@/lib/reports/print-label";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Send,
  Clock,
  Undo2,
  CheckCircle2,
  CheckCheck,
  Plus,
  Loader2,
  RefreshCw,
  XCircle,
  ArrowRight,
  Ship,
  ShoppingCart,
  Truck,
  ClipboardCheck,
  FileCheck2,
  Package,
  Repeat2,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileText,
  User,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { JournalPrintButton } from "@/components/reports/journal-print-button";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { cn } from "@/lib/utils";

type TransferTab = "incoming" | "sent" | "pending" | "returned" | "accepted" | "completed";
type TransferType =
  | "shipping_handover"
  | "purchase_booking"
  | "truck_task"
  | "goods_verification"
  | "clearing_bill"
  | "other";

type TransferRow = {
  id: string;
  transfer_no: string;
  transfer_type: TransferType;
  status: string;
  source_country_name?: string | null;
  dest_country_name?: string | null;
  source_branch_name?: string | null;
  dest_branch_name?: string | null;
  source_city_branch_name?: string | null;
  dest_city_branch_name?: string | null;
  sender_name?: string | null;
  receiver_name?: string | null;
  accepted_by_name?: string | null;
  completed_by_name?: string | null;
  narration?: string | null;
  remarks?: string | null;
  return_reason?: string | null;
  rejection_reason?: string | null;
  bill_number?: string | null;
  container_number?: string | null;
  order_reference?: string | null;
  bl_number?: string | null;
  job_number?: string | null;
  customer_party_name?: string | null;
  resubmit_count?: number;
  resubmitted_from_id?: string | null;
  created_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  metadata?: Record<string, any> | null;
};

type ScopeOption = { id: string; name: string };
type AssigneeUser = {
  id: string;
  userCode: string;
  name: string;
  role: string;
  countryName: string;
  cityBranchName: string;
  operationalDomain: string;
};

const TAB_ORDER: TransferTab[] = ["incoming", "sent", "pending", "returned", "accepted", "completed"];
const TAB_ICON: Record<TransferTab, any> = {
  incoming: Inbox,
  sent: Send,
  pending: Clock,
  returned: Undo2,
  accepted: CheckCircle2,
  completed: CheckCheck,
};
const TYPE_ICON: Record<TransferType, any> = {
  shipping_handover: Ship,
  purchase_booking: ShoppingCart,
  truck_task: Truck,
  goods_verification: ClipboardCheck,
  clearing_bill: FileCheck2,
  other: Package,
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "accepted" || status === "completed") return "default";
  if (status === "rejected") return "destructive";
  if (status === "returned" || status === "resubmitted") return "outline";
  return "secondary";
}

export function TransferHandoverCenter({ lang: langProp }: { lang?: string | null }) {
  const router = useRouter();
  const s = useErpScreen("tc", langProp);

  const [tab, setTab] = useState<TransferTab>("incoming");
  const [typeFilter, setTypeFilter] = useState<TransferType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<TransferRow[]>([]);
  const [counts, setCounts] = useState<Record<TransferTab, number>>({
    incoming: 0,
    sent: 0,
    pending: 0,
    returned: 0,
    accepted: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{ kind: "return" | "reject" } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (it) =>
        it.transfer_no?.toLowerCase().includes(q) ||
        it.order_reference?.toLowerCase().includes(q) ||
        it.sender_name?.toLowerCase().includes(q) ||
        it.receiver_name?.toLowerCase().includes(q) ||
        it.customer_party_name?.toLowerCase().includes(q) ||
        it.narration?.toLowerCase().includes(q) ||
        it.bill_number?.toLowerCase().includes(q) ||
        it.container_number?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const selected = useMemo(() => items.find((it) => it.id === selectedId) ?? null, [items, selectedId]);

  async function load() {
    setLoading(true);
    setActionError(null);
    try {
      const q = new URLSearchParams({ tab });
      if (typeFilter !== "all") q.set("type", typeFilter);
      const data = await apiGet<{
        transfers: TransferRow[];
        total: number;
        counts: Record<TransferTab, number>;
      }>(`/api/erp/transfer-center?${q.toString()}`);
      setItems(data.transfers || []);
      setCounts(
        data.counts || {
          incoming: 0,
          sent: 0,
          pending: 0,
          returned: 0,
          accepted: 0,
          completed: 0,
        }
      );
      setSelectedId((cur) => (data.transfers?.some((r) => r.id === cur) ? cur : data.transfers?.[0]?.id ?? null));
    } catch (err: any) {
      setActionError(err?.message || "Failed to load the Transfer & Handover Center.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, typeFilter]);

  async function runAction(action: "accept" | "return" | "reject" | "resubmit" | "complete", extra?: Record<string, unknown>) {
    if (!selected) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await apiPatch(`/api/erp/transfer-center/${selected.id}`, { action, ...extra });
      setReasonModal(null);
      setReasonText("");
      await load();
    } catch (err: any) {
      setActionError(err?.message || "Action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div dir={s.dir} className="space-y-4">
      {/* ── Standardized Page Header ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/50 dark:border-blue-900 dark:text-blue-400">
              <Repeat2 className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">
                  {s.t("breadcrumb_dashboard", "Dashboard")} &gt;{" "}
                  <span className="text-slate-700 dark:text-slate-300 font-bold">
                    {s.t("title", "Transfer & Handover Center")}
                  </span>
                </span>
              </div>
              <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                {s.t("heading", "Transfer & Handover Center")}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {s.t("subtitle", "User-to-user task delegation and branch operational handovers across canonical ERP records.")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <JournalPrintButton
              title={s.t("heading", "Transfer & Handover Center")}
              subtitle={s.t(`tab_${tab}`, tab.charAt(0).toUpperCase() + tab.slice(1))}
              columns={[
                { key: "transfer_no", label: pl("Transfer No"), align: "center" },
                { key: (r) => s.t(`type_${(r as any).transfer_type}`, String((r as any).transfer_type ?? "")), label: "Type" },
                { key: "order_reference", label: s.t("order_ref", "Order"), align: "center" },
                { key: "customer_party_name", label: s.t("party", "Party") },
                { key: "sender_name", label: s.t("sender", "Sender") },
                { key: (r) => String((r as any).receiver_name || (r as any).dest_city_branch_name || (r as any).dest_country_name || ""), label: s.t("receiver", "Receiver") },
                { key: "narration", label: s.t("narration", "Narration") },
                { key: "created_at", label: pl("Date"), align: "center", format: "date" },
                { key: (r) => s.t(`status_${(r as any).status}`, String((r as any).status ?? "")), label: "Status", align: "center" },
              ]}
              rows={filteredItems as unknown as Record<string, unknown>[]}
              fetchFullData={async () => {
                const q = new URLSearchParams({ tab, limit: "5000", offset: "0" });
                if (typeFilter !== "all") q.set("type", typeFilter);
                const data = await apiGet<{ transfers: TransferRow[] }>(`/api/erp/transfer-center?${q.toString()}`);
                const all = data.transfers || [];
                const needle = searchQuery.trim().toLowerCase();
                if (!needle) return all as unknown as Record<string, unknown>[];
                return all.filter((it) =>
                  [it.transfer_no, it.order_reference, it.sender_name, it.receiver_name, it.customer_party_name, it.narration, it.bill_number, it.container_number]
                    .some((v) => v?.toLowerCase().includes(needle))
                ) as unknown as Record<string, unknown>[];
              }}
              filters={[
                { label: "Type", value: typeFilter === "all" ? s.t("type_all", "All Types") : s.t(`type_${typeFilter}`, typeFilter) },
                ...(searchQuery.trim() ? [{ label: pl("Search"), value: searchQuery.trim() }] : []),
              ]}
              orientation="landscape"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="gap-1.5 text-xs font-bold"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>{s.t("refresh", "Refresh")}</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setNewOpen(true)}
              className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/25 text-xs font-bold"
            >
              <Plus className="h-4 w-4" />
              <span>{s.t("new_handover", "New Handover")}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Summary / KPI Cards Grid ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* 1. Incoming Pending */}
        <div
          onClick={() => setTab("incoming")}
          className={cn(
            "cursor-pointer rounded-2xl border bg-white p-3.5 shadow-sm transition hover:shadow-md dark:bg-slate-900",
            tab === "incoming"
              ? "border-blue-500 ring-2 ring-blue-100 dark:ring-blue-950"
              : "border-slate-200/90 dark:border-slate-800"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {s.t("kpi_incoming", "Incoming Tasks")}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Inbox className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">{counts.incoming}</div>
          <div className="mt-1 text-[9.5px] font-semibold text-blue-600 dark:text-blue-400">
            {s.t("kpi_action_required", "Action Required")}
          </div>
        </div>

        {/* 2. Sent Handovers */}
        <div
          onClick={() => setTab("sent")}
          className={cn(
            "cursor-pointer rounded-2xl border bg-white p-3.5 shadow-sm transition hover:shadow-md dark:bg-slate-900",
            tab === "sent"
              ? "border-purple-500 ring-2 ring-purple-100 dark:ring-purple-950"
              : "border-slate-200/90 dark:border-slate-800"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {s.t("kpi_sent", "Sent Handovers")}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Send className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-black text-purple-600 dark:text-purple-400">{counts.sent}</div>
          <div className="mt-1 text-[9.5px] font-semibold text-slate-500">
            {s.t("kpi_delegated", "Delegated by you")}
          </div>
        </div>

        {/* 3. Accepted Tasks */}
        <div
          onClick={() => setTab("accepted")}
          className={cn(
            "cursor-pointer rounded-2xl border bg-white p-3.5 shadow-sm transition hover:shadow-md dark:bg-slate-900",
            tab === "accepted"
              ? "border-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950"
              : "border-slate-200/90 dark:border-slate-800"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {s.t("kpi_accepted", "Accepted")}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">{counts.accepted}</div>
          <div className="mt-1 text-[9.5px] font-semibold text-slate-500">
            {s.t("kpi_in_progress", "In Active Progress")}
          </div>
        </div>

        {/* 4. Returned for Correction */}
        <div
          onClick={() => setTab("returned")}
          className={cn(
            "cursor-pointer rounded-2xl border bg-white p-3.5 shadow-sm transition hover:shadow-md dark:bg-slate-900",
            tab === "returned"
              ? "border-amber-500 ring-2 ring-amber-100 dark:ring-amber-950"
              : "border-slate-200/90 dark:border-slate-800"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {s.t("kpi_returned", "Returned")}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Undo2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-black text-amber-600 dark:text-amber-400">{counts.returned}</div>
          <div className="mt-1 text-[9.5px] font-semibold text-amber-600 dark:text-amber-400">
            {s.t("kpi_needs_review", "Needs Correction")}
          </div>
        </div>

        {/* 5. Completed Tasks */}
        <div
          onClick={() => setTab("completed")}
          className={cn(
            "cursor-pointer rounded-2xl border bg-white p-3.5 shadow-sm transition hover:shadow-md dark:bg-slate-900",
            tab === "completed"
              ? "border-slate-500 ring-2 ring-slate-100 dark:ring-slate-950"
              : "border-slate-200/90 dark:border-slate-800"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {s.t("kpi_completed", "Completed")}
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <CheckCheck className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-black text-slate-800 dark:text-slate-200">{counts.completed}</div>
          <div className="mt-1 text-[9.5px] font-semibold text-emerald-600 dark:text-emerald-400">
            {s.t("kpi_closed", "Successfully Closed")}
          </div>
        </div>
      </div>

      {/* ── 3-Pane Unified Workspace ── */}
      <div className="flex h-[calc(100vh-16rem)] min-h-[580px] w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {/* ── Left Navigation Rail (Inbox Tabs & Filters) ── */}
        <aside className="flex w-56 shrink-0 flex-col border-e border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <nav className="flex flex-col gap-1">
            {TAB_ORDER.map((t) => {
              const Icon = TAB_ICON[t];
              const active = t === tab;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold transition",
                    active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {s.t(`tab_${t}`, t.charAt(0).toUpperCase() + t.slice(1))}
                  </span>
                  {counts[t] > 0 && (
                    <span
                      className={cn(
                        "min-w-[1.4rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-black",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      )}
                    >
                      {counts[t]}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {s.t("filter_type", "Workflow Domain")}
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TransferType | "all")}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">{s.t("type_all", "All Types")}</option>
              <option value="shipping_handover">{s.t("type_shipping_handover", "Shipping Handover")}</option>
              <option value="purchase_booking">{s.t("type_purchase_booking", "Purchase Booking")}</option>
              <option value="truck_task">{s.t("type_truck_task", "Truck Task")}</option>
              <option value="goods_verification">{s.t("type_goods_verification", "Goods Verification")}</option>
              <option value="clearing_bill">{s.t("type_clearing_bill", "Clearing Bill")}</option>
              <option value="other">{s.t("type_other", "Other")}</option>
            </select>
          </div>
        </aside>

        {/* ── Middle List Pane ── */}
        <section className="flex w-84 shrink-0 flex-col border-e border-slate-200 dark:border-slate-800">
          <div className="border-b border-slate-200 p-2.5 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={s.t("search_ph", "Search transfers, orders, parties...")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs font-medium outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                {searchQuery ? s.t("no_matches", "No matching handovers.") : s.t("empty", "Nothing here.")}
              </div>
            ) : (
              filteredItems.map((it) => {
                const Icon = TYPE_ICON[it.transfer_type] || Package;
                const isSelected = it.id === selectedId;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setSelectedId(it.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-slate-100 p-3 text-start transition dark:border-slate-900",
                      isSelected
                        ? "border-s-4 border-s-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-900"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-slate-100">
                        <Icon className="h-3.5 w-3.5 text-blue-600" /> {it.transfer_no}
                      </span>
                      <Badge variant={statusBadgeVariant(it.status)} className="text-[9px] capitalize">
                        {s.t(`status_${it.status}`, it.status)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {it.order_reference && <span className="font-mono text-blue-600">{it.order_reference}</span>}
                      {it.customer_party_name && (
                        <span className="truncate text-slate-500">• {it.customer_party_name}</span>
                      )}
                    </div>

                    <span className="truncate text-[11px] text-slate-500">
                      {it.sender_name || "System"} <ArrowRight className="inline h-2.5 w-2.5 text-slate-400" />{" "}
                      {it.receiver_name || it.dest_city_branch_name || it.dest_country_name || "Any Branch Staff"}
                    </span>

                    {it.narration && (
                      <span className="truncate text-[10.5px] font-medium text-slate-600 dark:text-slate-400">
                        {it.narration}
                      </span>
                    )}

                    <div className="flex items-center justify-between pt-1 text-[9.5px] text-slate-400">
                      <span>{new Date(it.created_at).toLocaleString()}</span>
                      {it.metadata?.priority && (
                        <span
                          className={cn(
                            "font-bold uppercase",
                            it.metadata.priority === "urgent"
                              ? "text-red-500"
                              : it.metadata.priority === "high"
                              ? "text-amber-500"
                              : "text-slate-400"
                          )}
                        >
                          {it.metadata.priority}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* ── Right Detail Pane ── */}
        <section className="flex-1 overflow-y-auto p-5">
          {actionError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <XCircle className="h-4 w-4 shrink-0" /> {actionError}
            </div>
          )}

          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
              <Repeat2 className="h-10 w-10 text-slate-300 stroke-[1.5] mb-2" />
              <p className="text-sm font-semibold">{s.t("select_item", "Select a handover from the list.")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                      <Repeat2 className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                          {selected.transfer_no}
                        </h3>
                        <Badge variant={statusBadgeVariant(selected.status)} className="capitalize text-[10px]">
                          {s.t(`status_${selected.status}`, selected.status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        {s.t(`type_${selected.transfer_type}`, selected.transfer_type)} •{" "}
                        {new Date(selected.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {selected.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          disabled={actionBusy}
                          onClick={() => void runAction("accept")}
                          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {s.t("action_accept", "Accept")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionBusy}
                          onClick={() => setReasonModal({ kind: "return" })}
                          className="gap-1.5 text-xs font-bold"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> {s.t("action_return", "Return for Correction")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={actionBusy}
                          onClick={() => setReasonModal({ kind: "reject" })}
                          className="gap-1.5 text-xs font-bold"
                        >
                          <XCircle className="h-3.5 w-3.5" /> {s.t("action_reject", "Reject")}
                        </Button>
                      </>
                    )}
                    {selected.status === "returned" && (
                      <Button
                        size="sm"
                        disabled={actionBusy}
                        onClick={() => void runAction("resubmit")}
                        className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> {s.t("action_resubmit", "Resubmit")}
                      </Button>
                    )}
                    {selected.status === "accepted" && (
                      <Button
                        size="sm"
                        disabled={actionBusy}
                        onClick={() => void runAction("complete")}
                        className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> {s.t("action_complete", "Mark Completed")}
                      </Button>
                    )}
                    {actionBusy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                  </div>
                </div>

                {/* Sender & Receiver Summary Grid */}
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {s.t("sender", "Sender User")}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selected.sender_name || "—"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {s.t("receiver", "Receiver User")}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selected.receiver_name || selected.accepted_by_name || "Branch Pool"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {s.t("source", "Source Scope")}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {selected.source_city_branch_name || selected.source_branch_name || selected.source_country_name || "—"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {s.t("destination", "Destination Scope")}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {selected.dest_city_branch_name || selected.dest_branch_name || selected.dest_country_name || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Canonical Workflow Context & OPEN LINKED FORM ── */}
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 p-4 shadow-xs dark:border-blue-900/50 dark:from-blue-950/30 dark:to-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                      {s.t("canonical_workflow_context", "Canonical ERP Workflow Context")}
                    </span>
                  </div>
                  {selected.metadata?.priority && (
                    <Badge
                      variant={
                        selected.metadata.priority === "urgent"
                          ? "destructive"
                          : selected.metadata.priority === "high"
                          ? "outline"
                          : "secondary"
                      }
                      className="capitalize text-[10px] font-bold"
                    >
                      {selected.metadata.priority}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
                  {selected.metadata?.requestedTask && (
                    <div className="rounded-xl border border-white/80 bg-white/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/70">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {s.t("requested_task", "Requested Next Task")}
                      </span>
                      <span className="font-black text-blue-700 dark:text-blue-400 text-sm">
                        {selected.metadata.requestedTask}
                      </span>
                    </div>
                  )}
                  {selected.metadata?.currentStage && (
                    <div className="rounded-xl border border-white/80 bg-white/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/70">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {s.t("workflow_stage", "Workflow Stage")}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selected.metadata.currentStage}
                      </span>
                    </div>
                  )}
                </div>

                {/* Prominent OPEN LINKED FORM Button */}
                {(() => {
                  const targetUrl =
                    selected.metadata?.targetUrl ||
                    (selected.order_reference
                      ? `/dashboard/clearing-agent/customer-order`
                      : null);

                  return targetUrl ? (
                    <div className="pt-1">
                      <Button
                        size="sm"
                        onClick={() => router.push(targetUrl as any)}
                        className="w-full gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 hover:shadow-lg"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>{s.t("open_linked_form", "OPEN LINKED FORM")}</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <p className="mt-1 text-center text-[10px] text-slate-500 dark:text-slate-400">
                        {s.t("open_linked_desc", "Opens the original canonical ERP record — ZERO duplicate records or parallel forms.")}
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Reference Tags & Party Info */}
              {(selected.bill_number ||
                selected.container_number ||
                selected.bl_number ||
                selected.job_number ||
                selected.order_reference ||
                selected.customer_party_name) && (
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {selected.order_reference && (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                      {s.t("order_ref", "Order")}: {selected.order_reference}
                    </Badge>
                  )}
                  {selected.customer_party_name && (
                    <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300">
                      {s.t("party", "Party")}: {selected.customer_party_name}
                    </Badge>
                  )}
                  {selected.bill_number && (
                    <Badge variant="outline">{s.t("bill_no", "Bill")}: {selected.bill_number}</Badge>
                  )}
                  {selected.container_number && (
                    <Badge variant="outline">{s.t("container_no", "Container")}: {selected.container_number}</Badge>
                  )}
                  {selected.bl_number && (
                    <Badge variant="outline">{s.t("bl_no", "BL")}: {selected.bl_number}</Badge>
                  )}
                  {selected.job_number && (
                    <Badge variant="outline">{s.t("job_no", "Job")}: {selected.job_number}</Badge>
                  )}
                </div>
              )}

              {/* Instructions / Remarks */}
              {selected.narration && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    {s.t("narration", "Task Summary / Narration")}
                  </span>
                  <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {selected.narration}
                  </p>
                </div>
              )}

              {selected.remarks && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    {s.t("remarks", "Detailed Instructions / Remarks")}
                  </span>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300">
                    {selected.remarks}
                  </p>
                </div>
              )}

              {selected.return_reason && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                  <span className="block font-bold text-amber-800 dark:text-amber-200">
                    {s.t("return_reason", "Returned for Correction Reason")}
                  </span>
                  <p className="mt-1">{selected.return_reason}</p>
                </div>
              )}

              {selected.rejection_reason && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <span className="block font-bold text-red-800 dark:text-red-200">
                    {s.t("rejection_reason", "Rejection Reason")}
                  </span>
                  <p className="mt-1">{selected.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Reason Modal (Return / Reject) ── */}
      <Dialog open={!!reasonModal} onOpenChange={(open) => !open && setReasonModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonModal?.kind === "return"
                ? s.t("action_return", "Return for Correction")
                : s.t("action_reject", "Reject")}
            </DialogTitle>
          </DialogHeader>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={4}
            placeholder={s.t("reason_ph", "Explain what needs correction...")}
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReasonModal(null)}>
              {s.t("cancel", "Cancel")}
            </Button>
            <Button
              size="sm"
              variant={reasonModal?.kind === "reject" ? "destructive" : "default"}
              disabled={!reasonText.trim() || actionBusy}
              onClick={() => void runAction(reasonModal!.kind, { reason: reasonText.trim() })}
            >
              {s.t("submit", "Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Handover Creation Dialog ── */}
      <NewHandoverDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => {
          setNewOpen(false);
          setTab("sent");
          void load();
        }}
        s={s}
      />
    </div>
  );
}

// ─── New Handover Creation Dialog ──────────────────────────────────────────

function NewHandoverDialog({
  open,
  onClose,
  onCreated,
  s,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  s: ReturnType<typeof useErpScreen>;
}) {
  const [countries, setCountries] = useState<ScopeOption[]>([]);
  const [cityBranches, setCityBranches] = useState<(ScopeOption & { country_id?: string; country_branch_id?: string })[]>([]);
  const [assignees, setAssignees] = useState<AssigneeUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    transferType: "shipping_handover" as TransferType,
    sourceCountryId: "",
    sourceCityBranchId: "",
    destCountryId: "",
    destCityBranchId: "",
    receiverUserId: "",
    requestedTask: "",
    orderReference: "",
    narration: "",
    remarks: "",
    priority: "normal" as "normal" | "high" | "urgent",
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [c, cib, u] = await Promise.all([
          apiGet<{ countries: ScopeOption[] }>("/api/erp/locations/countries"),
          apiGet<{ cityBranches: (ScopeOption & { country_id?: string; country_branch_id?: string })[] }>("/api/branch-management/city-branches"),
          apiGet<{ users: AssigneeUser[] }>("/api/erp/users/eligible-assignees"),
        ]);
        setCountries(c.countries || []);
        setCityBranches(cib.cityBranches || []);
        setAssignees(u.users || []);
        if (c.countries?.length && !form.sourceCountryId) {
          setForm((f) => ({ ...f, sourceCountryId: c.countries[0].id, destCountryId: c.countries[0].id }));
        }
      } catch {
        // selectors stay empty on error
      }
    })();
  }, [open]);

  const sourceCities = cityBranches.filter((c) => !form.sourceCountryId || c.country_id === form.sourceCountryId);
  const destCities = cityBranches.filter((c) => !form.destCountryId || c.country_id === form.destCountryId);

  async function submit() {
    if (!form.sourceCountryId || !form.destCountryId) {
      setError(s.t("err_required", "Source and destination country are required."));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sourceBranch = cityBranches.find((c) => c.id === form.sourceCityBranchId);
      const destBranch = cityBranches.find((c) => c.id === form.destCityBranchId);
      await apiPost("/api/erp/transfer-center", {
        transferType: form.transferType,
        sourceCountryId: form.sourceCountryId,
        sourceCityBranchId: form.sourceCityBranchId || null,
        sourceCountryBranchId: sourceBranch?.country_branch_id || null,
        destCountryId: form.destCountryId,
        destCityBranchId: form.destCityBranchId || null,
        destCountryBranchId: destBranch?.country_branch_id || null,
        receiverUserId: form.receiverUserId || null,
        orderReference: form.orderReference || null,
        narration: form.requestedTask || form.narration || "Handover Task",
        remarks: form.remarks || null,
        metadata: {
          requestedTask: form.requestedTask || form.narration,
          priority: form.priority,
          orderReference: form.orderReference,
        },
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || "Failed to create the handover.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Plus className="h-4 w-4" />
            </span>
            <DialogTitle className="text-base font-black">
              {s.t("new_handover", "New Handover")}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {s.t("filter_type", "Workflow Type")}
            </label>
            <select
              value={form.transferType}
              onChange={(e) => setForm((f) => ({ ...f, transferType: e.target.value as TransferType }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="shipping_handover">{s.t("type_shipping_handover", "Shipping Handover")}</option>
              <option value="purchase_booking">{s.t("type_purchase_booking", "Purchase Booking")}</option>
              <option value="truck_task">{s.t("type_truck_task", "Truck Task")}</option>
              <option value="goods_verification">{s.t("type_goods_verification", "Goods Verification")}</option>
              <option value="clearing_bill">{s.t("type_clearing_bill", "Clearing Bill")}</option>
              <option value="other">{s.t("type_other", "Other")}</option>
            </select>
          </div>

          {/* User Assignee Selector */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {s.t("assignee_user", "Target User (Optional Handover Recipient)")}
            </label>
            <select
              value={form.receiverUserId}
              onChange={(e) => setForm((f) => ({ ...f, receiverUserId: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">{s.t("any_branch_staff", "Any Authorized Branch Staff")}</option>
              {assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.userCode}) — {u.role} [{u.cityBranchName || u.countryName}]
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {s.t("source_country", "Source Country")}
              </label>
              <select
                value={form.sourceCountryId}
                onChange={(e) => setForm((f) => ({ ...f, sourceCountryId: e.target.value, sourceCityBranchId: "" }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{s.t("select", "Select...")}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {s.t("source_branch", "Source Branch")}
              </label>
              <select
                value={form.sourceCityBranchId}
                onChange={(e) => setForm((f) => ({ ...f, sourceCityBranchId: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{s.t("select", "Select...")}</option>
                {sourceCities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {s.t("dest_country", "Destination Country")}
              </label>
              <select
                value={form.destCountryId}
                onChange={(e) => setForm((f) => ({ ...f, destCountryId: e.target.value, destCityBranchId: "" }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{s.t("select", "Select...")}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {s.t("dest_branch", "Destination Branch")}
              </label>
              <select
                value={form.destCityBranchId}
                onChange={(e) => setForm((f) => ({ ...f, destCityBranchId: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{s.t("select", "Select...")}</option>
                {destCities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {s.t("order_reference", "Order / Record Reference")}
            </label>
            <Input
              value={form.orderReference}
              onChange={(e) => setForm((f) => ({ ...f, orderReference: e.target.value }))}
              placeholder="e.g. CO-2026-0001"
              className="text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {s.t("requested_task", "Required Task / Stage")}
            </label>
            <Input
              value={form.requestedTask}
              onChange={(e) => setForm((f) => ({ ...f, requestedTask: e.target.value }))}
              placeholder="e.g. Complete Truck Details"
              className="text-xs"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {s.t("instructions", "Instructions / Message")}
            </label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              rows={3}
              placeholder="e.g. Please verify goods and complete truck details..."
              className="w-full rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            {s.t("cancel", "Cancel")}
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void submit()} className="gap-1.5 bg-blue-600 font-bold">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{s.t("submit", "Create Handover")}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
