"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
};

type ScopeOption = { id: string; name: string };

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
  const s = useErpScreen("tc", langProp);

  const [tab, setTab] = useState<TransferTab>("incoming");
  const [typeFilter, setTypeFilter] = useState<TransferType | "all">("all");
  const [items, setItems] = useState<TransferRow[]>([]);
  const [counts, setCounts] = useState<Record<TransferTab, number>>({
    incoming: 0, sent: 0, pending: 0, returned: 0, accepted: 0, completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{ kind: "return" | "reject" } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const selected = useMemo(() => items.find((it) => it.id === selectedId) ?? null, [items, selectedId]);

  async function load() {
    setLoading(true);
    setActionError(null);
    try {
      const params = new URLSearchParams({ tab, limit: "100" });
      if (typeFilter !== "all") params.set("type", typeFilter);
      const data = await apiGet<{ transfers: TransferRow[]; total: number; counts: Record<TransferTab, number> }>(
        `/api/erp/transfer-center?${params.toString()}`
      );
      setItems(data.transfers || []);
      setCounts((prev) => ({ ...prev, ...(data.counts || {}) }));
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
    <div dir={s.dir} className="flex h-[calc(100vh-8.5rem)] min-h-[560px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      {/* ── Folder rail ── */}
      <aside className="flex w-56 shrink-0 flex-col border-e border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">{s.t("title", "Transfer & Handover Center")}</h2>
        </div>
        <Button onClick={() => setNewOpen(true)} className="mb-3 w-full justify-center gap-1.5" size="sm">
          <Plus className="h-4 w-4" /> {s.t("new_handover", "New Handover")}
        </Button>
        <nav className="flex flex-col gap-0.5">
          {TAB_ORDER.map((t) => {
            const Icon = TAB_ICON[t];
            const active = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {s.t(`tab_${t}`, t.charAt(0).toUpperCase() + t.slice(1))}
                </span>
                {counts[t] > 0 && (
                  <span className={cn("min-w-[1.4rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold", active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200")}>
                    {counts[t]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
          <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{s.t("filter_type", "Type")}</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TransferType | "all")}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900"
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

      {/* ── List pane ── */}
      <section className="flex w-80 shrink-0 flex-col border-e border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500">{items.length} {s.t("items", "items")}</span>
          <button type="button" onClick={() => void load()} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", loading && "animate-spin")} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">{s.t("empty", "Nothing here.")}</p>
          ) : (
            items.map((it) => {
              const Icon = TYPE_ICON[it.transfer_type] || Package;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setSelectedId(it.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b border-slate-100 px-3 py-2.5 text-start transition dark:border-slate-900",
                    it.id === selectedId ? "bg-primary/10" : "hover:bg-slate-50 dark:hover:bg-slate-900"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                      <Icon className="h-3.5 w-3.5 text-primary" /> {it.transfer_no}
                    </span>
                    <Badge variant={statusBadgeVariant(it.status)} className="text-[9px]">{s.t(`status_${it.status}`, it.status)}</Badge>
                  </div>
                  <span className="truncate text-xs text-slate-600 dark:text-slate-400">
                    {it.source_city_branch_name || it.source_branch_name || it.source_country_name || "—"}
                    {" "}<ArrowRight className="inline h-3 w-3" />{" "}
                    {it.dest_city_branch_name || it.dest_branch_name || it.dest_country_name || "—"}
                  </span>
                  {it.narration && <span className="truncate text-[11px] text-slate-500">{it.narration}</span>}
                  <span className="text-[10px] text-slate-400">{new Date(it.created_at).toLocaleDateString()}</span>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* ── Detail pane ── */}
      <section className="flex-1 overflow-y-auto p-5">
        {actionError && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <XCircle className="h-4 w-4 shrink-0" /> {actionError}
          </div>
        )}
        {!selected ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            {s.t("select_item", "Select an item to view its details.")}
          </div>
        ) : (
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">{selected.transfer_no}</h3>
                <p className="text-xs text-slate-500">{s.t(`type_${selected.transfer_type}`, selected.transfer_type)}</p>
              </div>
              <Badge variant={statusBadgeVariant(selected.status)}>{s.t(`status_${selected.status}`, selected.status)}</Badge>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-900">
              <div>
                <span className="block font-bold text-slate-500">{s.t("source", "Source")}</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {selected.source_city_branch_name || selected.source_branch_name || "—"}, {selected.source_country_name || "—"}
                </span>
              </div>
              <div>
                <span className="block font-bold text-slate-500">{s.t("destination", "Destination")}</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {selected.dest_city_branch_name || selected.dest_branch_name || "—"}, {selected.dest_country_name || "—"}
                </span>
              </div>
              <div>
                <span className="block font-bold text-slate-500">{s.t("sender", "Sender")}</span>
                <span className="text-slate-800 dark:text-slate-200">{selected.sender_name || "—"}</span>
              </div>
              <div>
                <span className="block font-bold text-slate-500">{s.t("receiver", "Receiver")}</span>
                <span className="text-slate-800 dark:text-slate-200">{selected.receiver_name || selected.accepted_by_name || "—"}</span>
              </div>
            </div>

            {(selected.bill_number || selected.container_number || selected.bl_number || selected.job_number || selected.order_reference || selected.customer_party_name) && (
              <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
                {selected.bill_number && <Badge variant="outline">{s.t("bill_no", "Bill")}: {selected.bill_number}</Badge>}
                {selected.container_number && <Badge variant="outline">{s.t("container_no", "Container")}: {selected.container_number}</Badge>}
                {selected.bl_number && <Badge variant="outline">{s.t("bl_no", "BL")}: {selected.bl_number}</Badge>}
                {selected.job_number && <Badge variant="outline">{s.t("job_no", "Job")}: {selected.job_number}</Badge>}
                {selected.order_reference && <Badge variant="outline">{s.t("order_ref", "Order")}: {selected.order_reference}</Badge>}
                {selected.customer_party_name && <Badge variant="outline">{s.t("party", "Party")}: {selected.customer_party_name}</Badge>}
              </div>
            )}

            {selected.narration && (
              <div className="mb-3">
                <span className="block text-[11px] font-bold text-slate-500">{s.t("narration", "Narration")}</span>
                <p className="text-sm text-slate-800 dark:text-slate-200">{selected.narration}</p>
              </div>
            )}
            {selected.remarks && (
              <div className="mb-3">
                <span className="block text-[11px] font-bold text-slate-500">{s.t("remarks", "Remarks")}</span>
                <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{selected.remarks}</p>
              </div>
            )}
            {selected.return_reason && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                <span className="block font-bold">{s.t("return_reason", "Returned for correction")}</span>
                {selected.return_reason}
              </div>
            )}
            {selected.rejection_reason && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                <span className="block font-bold">{s.t("rejection_reason", "Rejected")}</span>
                {selected.rejection_reason}
              </div>
            )}
            {(selected.resubmit_count ?? 0) > 0 && (
              <p className="mb-3 text-[11px] text-slate-500">{s.t("resubmit_count", "Resubmitted")}: {selected.resubmit_count}</p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              {selected.status === "pending" && (
                <>
                  <Button size="sm" disabled={actionBusy} onClick={() => void runAction("accept")} className="gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> {s.t("action_accept", "Accept")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={actionBusy} onClick={() => setReasonModal({ kind: "return" })} className="gap-1.5">
                    <Undo2 className="h-4 w-4" /> {s.t("action_return", "Return for Correction")}
                  </Button>
                  <Button size="sm" variant="destructive" disabled={actionBusy} onClick={() => setReasonModal({ kind: "reject" })} className="gap-1.5">
                    <XCircle className="h-4 w-4" /> {s.t("action_reject", "Reject")}
                  </Button>
                </>
              )}
              {selected.status === "returned" && (
                <Button size="sm" disabled={actionBusy} onClick={() => void runAction("resubmit")} className="gap-1.5">
                  <RefreshCw className="h-4 w-4" /> {s.t("action_resubmit", "Resubmit")}
                </Button>
              )}
              {selected.status === "accepted" && (
                <Button size="sm" disabled={actionBusy} onClick={() => void runAction("complete")} className="gap-1.5">
                  <CheckCheck className="h-4 w-4" /> {s.t("action_complete", "Mark Completed")}
                </Button>
              )}
              {actionBusy && <Loader2 className="h-4 w-4 animate-spin self-center text-slate-400" />}
            </div>
          </Card>
        )}
      </section>

      {/* ── Reason modal (Return / Reject) ── */}
      <Dialog open={!!reasonModal} onOpenChange={(open) => !open && setReasonModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonModal?.kind === "return" ? s.t("action_return", "Return for Correction") : s.t("action_reject", "Reject")}
            </DialogTitle>
          </DialogHeader>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={4}
            placeholder={s.t("reason_ph", "Explain why...")}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonModal(null)}>{s.t("cancel", "Cancel")}</Button>
            <Button
              variant={reasonModal?.kind === "reject" ? "destructive" : "default"}
              disabled={!reasonText.trim() || actionBusy}
              onClick={() => void runAction(reasonModal!.kind, { reason: reasonText.trim() })}
            >
              {s.t("submit", "Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewHandoverDialog open={newOpen} onClose={() => setNewOpen(false)} onCreated={() => { setNewOpen(false); setTab("sent"); void load(); }} s={s} />
    </div>
  );
}

// ─── New Handover creation dialog ──────────────────────────────────────────

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
  const [countryBranches, setCountryBranches] = useState<(ScopeOption & { country_id?: string })[]>([]);
  const [cityBranches, setCityBranches] = useState<(ScopeOption & { country_id?: string; country_branch_id?: string })[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    transferType: "shipping_handover" as TransferType,
    sourceCountryId: "",
    sourceCityBranchId: "",
    destCountryId: "",
    destCityBranchId: "",
    narration: "",
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [c, cb, cib] = await Promise.all([
          apiGet<{ countries: ScopeOption[] }>("/api/erp/locations/countries"),
          apiGet<{ countryBranches: (ScopeOption & { country_id?: string })[] }>("/api/branch-management/country-branches"),
          apiGet<{ cityBranches: (ScopeOption & { country_id?: string; country_branch_id?: string })[] }>("/api/branch-management/city-branches"),
        ]);
        setCountries(c.countries || []);
        setCountryBranches(cb.countryBranches || []);
        setCityBranches(cib.cityBranches || []);
      } catch {
        // master-data load failure surfaces as an empty selector; the form will
        // still validate required fields before submit
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
        narration: form.narration || null,
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
          <DialogTitle>{s.t("new_handover", "New Handover")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{s.t("filter_type", "Type")}</label>
            <select
              value={form.transferType}
              onChange={(e) => setForm((f) => ({ ...f, transferType: e.target.value as TransferType }))}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="shipping_handover">{s.t("type_shipping_handover", "Shipping Handover")}</option>
              <option value="purchase_booking">{s.t("type_purchase_booking", "Purchase Booking")}</option>
              <option value="truck_task">{s.t("type_truck_task", "Truck Task")}</option>
              <option value="goods_verification">{s.t("type_goods_verification", "Goods Verification")}</option>
              <option value="clearing_bill">{s.t("type_clearing_bill", "Clearing Bill")}</option>
              <option value="other">{s.t("type_other", "Other")}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{s.t("source_country", "Source Country")}</label>
              <select
                value={form.sourceCountryId}
                onChange={(e) => setForm((f) => ({ ...f, sourceCountryId: e.target.value, sourceCityBranchId: "" }))}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{s.t("select", "Select...")}</option>
                {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{s.t("source_branch", "Source Branch")}</label>
              <select
                value={form.sourceCityBranchId}
                onChange={(e) => setForm((f) => ({ ...f, sourceCityBranchId: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{s.t("select", "Select...")}</option>
                {sourceCities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{s.t("dest_country", "Destination Country")}</label>
              <select
                value={form.destCountryId}
                onChange={(e) => setForm((f) => ({ ...f, destCountryId: e.target.value, destCityBranchId: "" }))}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{s.t("select", "Select...")}</option>
                {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{s.t("dest_branch", "Destination Branch")}</label>
              <select
                value={form.destCityBranchId}
                onChange={(e) => setForm((f) => ({ ...f, destCityBranchId: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{s.t("select", "Select...")}</option>
                {destCities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{s.t("narration", "Narration")}</label>
            <Input value={form.narration} onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))} placeholder={s.t("narration_ph", "What is being handed over...")} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{s.t("cancel", "Cancel")}</Button>
          <Button disabled={saving} onClick={() => void submit()} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {s.t("create", "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
