"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Truck, ClipboardCheck, Send, CheckCircle2, Loader2, XCircle,
  ArrowRight, Ship, FileCheck2, Package, ChevronRight, Repeat2, CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { cn } from "@/lib/utils";
import { TaskHandoverModal } from "@/features/transfer-center/components/task-handover-modal";
import {
  getCountryCustomsFieldConfig, CLEARANCE_TYPES, DUTY_TREATMENTS, CUSTOMS_STATUSES,
  type CustomsFieldKey,
} from "@/lib/services/clearing-country-customs-config";

const STAGES = [
  "booking", "truck_assignment", "goods_verification", "loading",
  "customs_clearing", "shipment_bl", "handover", "destination_review", "completed",
] as const;
type Stage = (typeof STAGES)[number];

type Leg = {
  id: string;
  order_id: string;
  leg_no: number;
  from_country_name: string | null;
  to_country_name: string | null;
  transport_mode: string | null;
  stage: Stage;
  status: string;
  truck_number: string | null;
  truck_driver_name: string | null;
  truck_registration_type: string | null;
  bl_number: string | null;
  container_number: string | null;
  vessel_name: string | null;
  clearance_type: string | null;
  duty_treatment: string | null;
  customs_country_id: string | null;
  customs_status: string | null;
  bill_of_entry_no: string | null;
  pgm_number: string | null;
  declaration_reference: string | null;
  customs_receipt_ref: string | null;
  duty_amount: number | null;
  duty_currency: string | null;
  responsible_country_branch_id: string | null;
  responsible_city_branch_id: string | null;
  current_task_id: string | null;
  transfer_center_id: string | null;
};

type OrderData = {
  id: string;
  order_no: string;
  customer_name: string;
  route_name: string | null;
  movement_type: string;
  transport_mode: string;
  current_stage: Stage;
  goods_name: string | null;
  goods_quantity: number | null;
  goods_unit: string | null;
  goods_bags_cartons: number | null;
  goods_gross_weight: number | null;
  goods_net_weight: number | null;
  legs: Leg[];
};

function stageIndex(stage: string) {
  const i = STAGES.indexOf(stage as Stage);
  return i < 0 ? 0 : i;
}

export function OrderWorkflowView({ orderId, lang }: { orderId: string; lang?: string | null }) {
  const s = useErpScreen("owf", lang);
  const [order, setOrder] = useState<OrderData | null>(null);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLegId, setSelectedLegId] = useState<string | null>(null);
  const [truckModalOpen, setTruckModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [handoffModalOpen, setHandoffModalOpen] = useState(false);
  const [customsModalOpen, setCustomsModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ order: OrderData; verifications: any[]; transfers: any[] }>(
        `/api/erp/clearing-agent/customer-order/${orderId}/workflow`
      );
      setOrder(data.order);
      setVerifications(data.verifications || []);
      setTransfers(data.transfers || []);
      setSelectedLegId((cur) => cur ?? data.order?.legs?.[0]?.id ?? null);
    } catch (err: any) {
      setError(err?.message || "Failed to load the shipment workflow.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const selectedLeg = useMemo(() => order?.legs.find((l) => l.id === selectedLegId) ?? null, [order, selectedLegId]);
  const legTransfers = useMemo(() => transfers.filter((t) => t.source_id === selectedLegId), [transfers, selectedLegId]);
  const legVerifications = useMemo(() => verifications.filter((v) => v.leg_id === selectedLegId), [verifications, selectedLegId]);

  const activeHandover = useMemo(() => {
    return transfers.find((t) => t.status === "pending" || t.status === "accepted") || null;
  }, [transfers]);

  async function runHandoverAction(transferId: string, action: "accept" | "complete") {
    try {
      await apiPatch(`/api/erp/transfer-center/${transferId}`, { action });
      await load();
    } catch (err: any) {
      setError(err?.message || "Handover action failed.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (error || !order) {
    return <p className="p-6 text-sm text-red-600">{error || s.t("not_found", "Order not found.")}</p>;
  }

  return (
    <div dir={s.dir} className="space-y-4">
      {/* ── Active Handover Task Banner ── */}
      {activeHandover && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-4 shadow-sm dark:border-blue-900/60 dark:from-blue-950/40 dark:to-indigo-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/25 shrink-0">
                <Repeat2 className="h-4 w-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    {s.t("active_handover_task", "Active Handover Task")}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-bold border-blue-300 text-blue-700 bg-white dark:bg-slate-900">
                    {activeHandover.metadata?.requestedTask || activeHandover.narration || "Task Assigned"}
                  </Badge>
                  {activeHandover.metadata?.priority && (
                    <Badge variant={activeHandover.metadata.priority === "urgent" ? "destructive" : "secondary"} className="text-[9px] uppercase">
                      {activeHandover.metadata.priority}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {s.t("assigned_by", "Assigned by")}: <span className="font-bold text-slate-800 dark:text-slate-200">{activeHandover.sender_name || "Branch User"}</span> • {s.t("instruction", "Instruction")}: <span className="italic font-medium">"{activeHandover.remarks || activeHandover.narration || "Please complete assigned work."}"</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeHandover.status === "pending" && (
                <Button size="sm" onClick={() => void runHandoverAction(activeHandover.id, "accept")} className="gap-1.5 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {s.t("accept_task", "Accept Task")}
                </Button>
              )}
              {activeHandover.status === "accepted" && (
                <Button size="sm" onClick={() => void runHandoverAction(activeHandover.id, "complete")} className="gap-1.5 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700">
                  <CheckCheck className="h-3.5 w-3.5" /> {s.t("complete_task", "Mark Done")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setHandoffModalOpen(true)} className="gap-1.5 text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300">
                <Send className="h-3.5 w-3.5" /> {s.t("transfer_next", "Handover to Next User")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{order.order_no}</h2>
            <p className="text-sm text-slate-500">{order.customer_name} — {order.route_name || `${order.movement_type} / ${order.transport_mode}`}</p>
          </div>
          <Badge>{s.t(`stage_${order.current_stage}`, order.current_stage)}</Badge>
        </div>
        {/* Stage progress bar */}
        <div className="mt-4 flex flex-wrap items-center gap-1 text-[10px] font-bold">
          {STAGES.map((st, i) => (
            <div key={st} className="flex items-center gap-1">
              <span
                className={cn(
                  "rounded-full px-2 py-1",
                  i <= stageIndex(order.current_stage) ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                )}
              >
                {s.t(`stage_${st}`, st)}
              </span>
              {i < STAGES.length - 1 && <ChevronRight className="h-3 w-3 text-slate-300" />}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Legs list */}
        <Card className="p-3 lg:col-span-1">
          <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">{s.t("legs", "Route Legs")}</h3>
          <div className="space-y-1.5">
            {order.legs.map((leg) => (
              <button
                key={leg.id}
                type="button"
                onClick={() => setSelectedLegId(leg.id)}
                className={cn(
                  "flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-start text-xs transition",
                  leg.id === selectedLegId ? "border-primary bg-primary/10" : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">{s.t("leg", "Leg")} {leg.leg_no}</span>
                  <Badge variant="outline" className="text-[9px]">{s.t(`stage_${leg.stage}`, leg.stage)}</Badge>
                </div>
                <span className="text-slate-500">
                  {leg.from_country_name || "—"} <ArrowRight className="inline h-3 w-3" /> {leg.to_country_name || "—"}
                </span>
                {leg.truck_number && <span className="text-slate-400">🚚 {leg.truck_number}</span>}
              </button>
            ))}
            {order.legs.length === 0 && <p className="text-xs text-slate-400">{s.t("no_legs", "No route legs recorded.")}</p>}
          </div>
        </Card>

        {/* Selected leg detail + actions */}
        <Card className="p-4 lg:col-span-2">
          {!selectedLeg ? (
            <p className="text-sm text-slate-400">{s.t("select_leg", "Select a leg.")}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {s.t("leg", "Leg")} {selectedLeg.leg_no}: {selectedLeg.from_country_name} <ArrowRight className="inline h-4 w-4" /> {selectedLeg.to_country_name}
                </h3>
                <Badge>{s.t(`stage_${selectedLeg.stage}`, selectedLeg.stage)}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
                  <span className="block font-bold text-slate-500">{s.t("truck", "Truck")}</span>
                  <span>{selectedLeg.truck_number || "—"}</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
                  <span className="block font-bold text-slate-500">{s.t("driver", "Driver")}</span>
                  <span>{selectedLeg.truck_driver_name || "—"}</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
                  <span className="block font-bold text-slate-500">{s.t("bl_container", "BL / Container")}</span>
                  <span>{selectedLeg.bl_number || selectedLeg.container_number || "—"}</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
                  <span className="block font-bold text-slate-500">{s.t("customs", "Customs")}</span>
                  <span>{selectedLeg.clearance_type || "—"} / {selectedLeg.duty_treatment || "—"}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTruckModalOpen(true)}>
                  <Truck className="h-4 w-4" /> {s.t("assign_truck_task", "Assign Truck / Task")}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setVerifyModalOpen(true)}>
                  <ClipboardCheck className="h-4 w-4" /> {s.t("goods_verification", "Goods Verification")}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setHandoffModalOpen(true)}>
                  <Send className="h-4 w-4" /> {s.t("send_handoff", "Send Handoff")}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCustomsModalOpen(true)}>
                  <FileCheck2 className="h-4 w-4" /> {s.t("customs_clearing_action", "Customs / Clearing")}
                </Button>
              </div>

              {legTransfers.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-bold text-slate-500">{s.t("handoffs", "Transfer Center Handoffs")}</h4>
                  <div className="space-y-1">
                    {legTransfers.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-xs dark:bg-slate-900">
                        <span>{t.transfer_no}</span>
                        <Badge variant="outline" className="text-[9px]">{s.t(`status_${t.status}`, t.status)}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {legVerifications.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-bold text-slate-500">{s.t("verification_history", "Verification History")}</h4>
                  <div className="space-y-1">
                    {legVerifications.map((v) => (
                      <div key={v.id} className="rounded bg-slate-50 px-2 py-1.5 text-xs dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{v.verified_by_name || "—"}</span>
                          <Badge variant={v.result === "verified" ? "default" : "destructive"} className="text-[9px]">{s.t(`result_${v.result}`, v.result)}</Badge>
                        </div>
                        {v.discrepancy_notes && <p className="text-slate-500">{v.discrepancy_notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {selectedLeg && (
        <>
          <TruckTaskDialog open={truckModalOpen} onClose={() => setTruckModalOpen(false)} orderId={orderId} legId={selectedLeg.id} s={s} onDone={() => { setTruckModalOpen(false); void load(); }} />
          <GoodsVerificationDialog open={verifyModalOpen} onClose={() => setVerifyModalOpen(false)} orderId={orderId} legId={selectedLeg.id} order={order} s={s} onDone={() => { setVerifyModalOpen(false); void load(); }} />
          <TaskHandoverModal
            open={handoffModalOpen}
            onClose={() => setHandoffModalOpen(false)}
            orderReference={order.order_no}
            sourceTable="clearing_customer_order_legs"
            sourceId={selectedLeg.id}
            targetUrl={`/dashboard/clearing-agent/customer-order/${order.id}/workflow?leg=${selectedLeg.id}`}
            currentStage={selectedLeg.stage || order.current_stage}
            defaultTask={s.t("task_default_truck", "Complete Truck Details & Loading")}
            sourceCountryId={(order as any).country_id || "74a7482f-e8b0-4f59-a292-9a008c2a969f"}
            sourceCountryBranchId={(order as any).country_branch_id || selectedLeg.responsible_country_branch_id}
            sourceCityBranchId={(order as any).city_branch_id || selectedLeg.responsible_city_branch_id}
            domain="shipping"
            customerPartyName={order.customer_name}
            onSuccess={() => {
              setHandoffModalOpen(false);
              void load();
            }}
            lang={lang}
          />
          <CustomsDialog open={customsModalOpen} onClose={() => setCustomsModalOpen(false)} orderId={orderId} leg={selectedLeg} s={s} onDone={() => { setCustomsModalOpen(false); void load(); }} />
        </>
      )}
    </div>
  );
}

function TruckTaskDialog({ open, onClose, orderId, legId, s, onDone }: { open: boolean; onClose: () => void; orderId: string; legId: string; s: ReturnType<typeof useErpScreen>; onDone: () => void }) {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({ truckId: "", truckRegistrationType: "registered" as "registered" | "temporary", truckNumber: "", truckDriverName: "", truckDriverMobile: "", assignedUserId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [t, u] = await Promise.all([
          apiGet<{ trucks: any[] }>("/api/erp/master-data/trucks?selectable=true"),
          apiGet<{ users: any[] }>("/api/erp/user-tasks/assignees"),
        ]);
        setTrucks(t.trucks || []);
        setUsers(u.users || []);
      } catch { /* selectors stay empty; submit still validates required fields */ }
    })();
  }, [open]);

  async function submit() {
    if (!form.truckNumber || !form.assignedUserId) { setError(s.t("err_required", "Truck number and assignee are required.")); return; }
    setSaving(true); setError(null);
    try {
      await apiPost(`/api/erp/clearing-agent/customer-order/${orderId}/legs/${legId}/assign-truck-task`, {
        truckId: form.truckRegistrationType === "registered" ? (form.truckId || null) : null,
        truckRegistrationType: form.truckRegistrationType,
        truckNumber: form.truckNumber,
        truckDriverName: form.truckDriverName || null,
        truckDriverMobile: form.truckDriverMobile || null,
        assignedUserId: form.assignedUserId,
      });
      onDone();
    } catch (err: any) {
      setError(err?.message || "Failed.");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{s.t("assign_truck_task", "Assign Truck / Task")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <select value={form.truckRegistrationType} onChange={(e) => setForm((f) => ({ ...f, truckRegistrationType: e.target.value as any }))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="registered">{s.t("registered_truck", "Registered Truck")}</option>
            <option value="temporary">{s.t("temporary_truck", "Temporary Truck")}</option>
          </select>
          {form.truckRegistrationType === "registered" && (
            <select value={form.truckId} onChange={(e) => { const t = trucks.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, truckId: e.target.value, truckNumber: t?.truck_number || f.truckNumber, truckDriverName: t?.driver_name || f.truckDriverName, truckDriverMobile: t?.driver_mobile || f.truckDriverMobile })); }} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
              <option value="">{s.t("select", "Select...")}</option>
              {trucks.map((t) => <option key={t.id} value={t.id}>{t.truck_number}{t.driver_name ? ` — ${t.driver_name}` : ""}</option>)}
            </select>
          )}
          <Input placeholder={s.t("truck_number", "Truck Number")} value={form.truckNumber} onChange={(e) => setForm((f) => ({ ...f, truckNumber: e.target.value }))} />
          <Input placeholder={s.t("driver_name", "Driver Name")} value={form.truckDriverName} onChange={(e) => setForm((f) => ({ ...f, truckDriverName: e.target.value }))} />
          <Input placeholder={s.t("driver_mobile", "Driver Mobile")} value={form.truckDriverMobile} onChange={(e) => setForm((f) => ({ ...f, truckDriverMobile: e.target.value }))} />
          <select value={form.assignedUserId} onChange={(e) => setForm((f) => ({ ...f, assignedUserId: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">{s.t("assign_to", "Assign To...")}</option>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{s.t("cancel", "Cancel")}</Button>
          <Button disabled={saving} onClick={() => void submit()} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {s.t("assign", "Assign")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoodsVerificationDialog({ open, onClose, orderId, legId, order, s, onDone }: { open: boolean; onClose: () => void; orderId: string; legId: string; order: OrderData; s: ReturnType<typeof useErpScreen>; onDone: () => void }) {
  const [form, setForm] = useState({ verifiedQuantity: "", verifiedCartons: "", verifiedGrossWeight: "", verifiedNetWeight: "", result: "verified" as "verified" | "discrepancy", discrepancyNotes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (form.result === "discrepancy" && !form.discrepancyNotes.trim()) { setError(s.t("err_discrepancy_notes", "Discrepancy notes are required.")); return; }
    setSaving(true); setError(null);
    try {
      await apiPost(`/api/erp/clearing-agent/customer-order/${orderId}/legs/${legId}/goods-verification`, {
        bookedQuantity: order.goods_quantity, bookedUnit: order.goods_unit, bookedCartons: order.goods_bags_cartons,
        bookedGrossWeight: order.goods_gross_weight, bookedNetWeight: order.goods_net_weight,
        verifiedQuantity: form.verifiedQuantity ? Number(form.verifiedQuantity) : null,
        verifiedCartons: form.verifiedCartons ? Number(form.verifiedCartons) : null,
        verifiedGrossWeight: form.verifiedGrossWeight ? Number(form.verifiedGrossWeight) : null,
        verifiedNetWeight: form.verifiedNetWeight ? Number(form.verifiedNetWeight) : null,
        result: form.result,
        discrepancyNotes: form.discrepancyNotes || null,
      });
      onDone();
    } catch (err: any) {
      setError(err?.message || "Failed.");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{s.t("goods_verification", "Goods Verification")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <p className="rounded bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
            {s.t("booked", "Booked")}: {order.goods_quantity ?? "—"} {order.goods_unit || ""} / {order.goods_bags_cartons ?? "—"} {s.t("cartons", "cartons")} / {order.goods_gross_weight ?? "—"} kg
          </p>
          <Input placeholder={s.t("verified_quantity", "Verified Quantity")} value={form.verifiedQuantity} onChange={(e) => setForm((f) => ({ ...f, verifiedQuantity: e.target.value }))} />
          <Input placeholder={s.t("verified_cartons", "Verified Cartons")} value={form.verifiedCartons} onChange={(e) => setForm((f) => ({ ...f, verifiedCartons: e.target.value }))} />
          <Input placeholder={s.t("verified_gross_weight", "Verified Gross Weight (kg)")} value={form.verifiedGrossWeight} onChange={(e) => setForm((f) => ({ ...f, verifiedGrossWeight: e.target.value }))} />
          <Input placeholder={s.t("verified_net_weight", "Verified Net Weight (kg)")} value={form.verifiedNetWeight} onChange={(e) => setForm((f) => ({ ...f, verifiedNetWeight: e.target.value }))} />
          <select value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value as any }))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="verified">{s.t("verified_accept", "Verified / Accept")}</option>
            <option value="discrepancy">{s.t("discrepancy_found", "Discrepancy Found")}</option>
          </select>
          {form.result === "discrepancy" && (
            <textarea value={form.discrepancyNotes} onChange={(e) => setForm((f) => ({ ...f, discrepancyNotes: e.target.value }))} rows={3} placeholder={s.t("discrepancy_notes_ph", "Describe the discrepancy...")} className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{s.t("cancel", "Cancel")}</Button>
          <Button disabled={saving} onClick={() => void submit()} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {s.t("submit", "Submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomsDialog({ open, onClose, orderId, leg, s, onDone }: { open: boolean; onClose: () => void; orderId: string; leg: Leg; s: ReturnType<typeof useErpScreen>; onDone: () => void }) {
  const [countries, setCountries] = useState<any[]>([]);
  const [form, setForm] = useState({
    customsCountryId: leg.customs_country_id || "",
    clearanceType: (leg.clearance_type as string) || "import",
    dutyTreatment: (leg.duty_treatment as string) || "pending",
    customsStatus: (leg.customs_status as string) || "pending",
    billOfEntryNo: leg.bill_of_entry_no || "",
    pgmNumber: leg.pgm_number || "",
    declarationReference: leg.declaration_reference || "",
    customsReceiptRef: leg.customs_receipt_ref || "",
    dutyAmount: leg.duty_amount != null ? String(leg.duty_amount) : "",
    dutyCurrency: leg.duty_currency || "",
    taxAmount: "",
    otherCharges: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    apiGet<{ countries: any[] }>("/api/erp/locations/countries").then((c) => setCountries(c.countries || [])).catch(() => {});
  }, [open]);

  const selectedCountry = countries.find((c) => c.id === form.customsCountryId);
  const config = getCountryCustomsFieldConfig(selectedCountry?.iso2 || null);

  function fieldLabel(key: CustomsFieldKey) {
    return config.fieldLabels[key] || key;
  }
  function isVisible(key: CustomsFieldKey) {
    return config.fields.includes(key);
  }
  function isRequired(key: CustomsFieldKey) {
    return form.customsStatus === "cleared" && config.requiredForClearance.includes(key);
  }

  async function submit() {
    for (const key of config.requiredForClearance) {
      if (form.customsStatus === "cleared") {
        const val = (form as any)[key];
        if (!val || String(val).trim() === "") {
          setError(s.t("err_customs_required", `${fieldLabel(key)} is required to mark this leg cleared.`).replace("{field}", fieldLabel(key)));
          return;
        }
      }
    }
    setSaving(true); setError(null);
    try {
      await apiPost(`/api/erp/clearing-agent/customer-order/${orderId}/legs/${leg.id}/customs`, {
        customsCountryId: form.customsCountryId || null,
        clearanceType: form.clearanceType,
        dutyTreatment: form.dutyTreatment,
        customsStatus: form.customsStatus,
        billOfEntryNo: form.billOfEntryNo || null,
        pgmNumber: form.pgmNumber || null,
        declarationReference: form.declarationReference || null,
        customsReceiptRef: form.customsReceiptRef || null,
        dutyAmount: form.dutyAmount ? Number(form.dutyAmount) : null,
        dutyCurrency: form.dutyCurrency || null,
        taxAmount: form.taxAmount ? Number(form.taxAmount) : null,
        otherCharges: form.otherCharges ? Number(form.otherCharges) : null,
      });
      onDone();
    } catch (err: any) {
      setError(err?.message || "Failed.");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{s.t("customs_clearing_action", "Customs / Clearing")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}

          <select value={form.customsCountryId} onChange={(e) => setForm((f) => ({ ...f, customsCountryId: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">{s.t("customs_country", "Customs Country")}</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{s.t("clearance_type", "Clearance Type")}</label>
              <select value={form.clearanceType} onChange={(e) => setForm((f) => ({ ...f, clearanceType: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                {CLEARANCE_TYPES.map((t) => <option key={t} value={t}>{s.t(`clearance_${t}`, t)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-400">{s.t("duty_treatment", "Duty Treatment")}</label>
              <select value={form.dutyTreatment} onChange={(e) => setForm((f) => ({ ...f, dutyTreatment: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                {DUTY_TREATMENTS.map((t) => <option key={t} value={t}>{s.t(`duty_${t}`, t)}</option>)}
              </select>
            </div>
          </div>

          {/* Country-specific fields — which of these show depends on the selected customs country */}
          {isVisible("billOfEntryNo") && (
            <Input placeholder={fieldLabel("billOfEntryNo") + (isRequired("billOfEntryNo") ? " *" : "")} value={form.billOfEntryNo} onChange={(e) => setForm((f) => ({ ...f, billOfEntryNo: e.target.value }))} />
          )}
          {isVisible("pgmNumber") && (
            <Input placeholder={fieldLabel("pgmNumber") + (isRequired("pgmNumber") ? " *" : "")} value={form.pgmNumber} onChange={(e) => setForm((f) => ({ ...f, pgmNumber: e.target.value }))} />
          )}
          {isVisible("declarationReference") && (
            <Input placeholder={fieldLabel("declarationReference") + (isRequired("declarationReference") ? " *" : "")} value={form.declarationReference} onChange={(e) => setForm((f) => ({ ...f, declarationReference: e.target.value }))} />
          )}
          {isVisible("customsReceiptRef") && (
            <Input placeholder={fieldLabel("customsReceiptRef") + (isRequired("customsReceiptRef") ? " *" : "")} value={form.customsReceiptRef} onChange={(e) => setForm((f) => ({ ...f, customsReceiptRef: e.target.value }))} />
          )}
          <div className="grid grid-cols-2 gap-3">
            {isVisible("dutyAmount") && <Input placeholder={fieldLabel("dutyAmount")} value={form.dutyAmount} onChange={(e) => setForm((f) => ({ ...f, dutyAmount: e.target.value }))} />}
            {isVisible("taxAmount") && <Input placeholder={fieldLabel("taxAmount")} value={form.taxAmount} onChange={(e) => setForm((f) => ({ ...f, taxAmount: e.target.value }))} />}
          </div>
          {isVisible("otherCharges") && <Input placeholder={fieldLabel("otherCharges")} value={form.otherCharges} onChange={(e) => setForm((f) => ({ ...f, otherCharges: e.target.value }))} />}

          <select value={form.customsStatus} onChange={(e) => setForm((f) => ({ ...f, customsStatus: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            {CUSTOMS_STATUSES.map((st) => <option key={st} value={st}>{s.t(`customs_status_${st}`, st)}</option>)}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{s.t("cancel", "Cancel")}</Button>
          <Button disabled={saving} onClick={() => void submit()} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {s.t("submit", "Submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
