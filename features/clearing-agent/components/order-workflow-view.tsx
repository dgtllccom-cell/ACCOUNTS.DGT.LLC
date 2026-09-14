"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Truck, ClipboardCheck, Send, CheckCircle2, Loader2, XCircle,
  ArrowRight, Ship, FileCheck2, Package, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { cn } from "@/lib/utils";

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
          <HandoffDialog open={handoffModalOpen} onClose={() => setHandoffModalOpen(false)} orderId={orderId} legId={selectedLeg.id} s={s} onDone={() => { setHandoffModalOpen(false); void load(); }} />
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

function HandoffDialog({ open, onClose, orderId, legId, s, onDone }: { open: boolean; onClose: () => void; orderId: string; legId: string; s: ReturnType<typeof useErpScreen>; onDone: () => void }) {
  const [countries, setCountries] = useState<any[]>([]);
  const [cityBranches, setCityBranches] = useState<any[]>([]);
  const [form, setForm] = useState({ toCountryId: "", toCityBranchId: "", narration: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [c, cb] = await Promise.all([
          apiGet<{ countries: any[] }>("/api/erp/locations/countries"),
          apiGet<{ cityBranches: any[] }>("/api/branch-management/city-branches"),
        ]);
        setCountries(c.countries || []);
        setCityBranches(cb.cityBranches || []);
      } catch { /* selectors stay empty */ }
    })();
  }, [open]);

  const destCities = cityBranches.filter((c) => !form.toCountryId || c.country_id === form.toCountryId);

  async function submit() {
    if (!form.toCountryId) { setError(s.t("err_required", "Destination country is required.")); return; }
    setSaving(true); setError(null);
    try {
      const branch = cityBranches.find((c) => c.id === form.toCityBranchId);
      await apiPost(`/api/erp/clearing-agent/customer-order/${orderId}/legs/${legId}/handoff`, {
        toCountryId: form.toCountryId,
        toCityBranchId: form.toCityBranchId || null,
        toCountryBranchId: branch?.country_branch_id || null,
        narration: form.narration || null,
      });
      onDone();
    } catch (err: any) {
      setError(err?.message || "Failed.");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{s.t("send_handoff", "Send Handoff")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {error && <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          <select value={form.toCountryId} onChange={(e) => setForm((f) => ({ ...f, toCountryId: e.target.value, toCityBranchId: "" }))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">{s.t("dest_country", "Destination Country")}</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={form.toCityBranchId} onChange={(e) => setForm((f) => ({ ...f, toCityBranchId: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <option value="">{s.t("dest_branch", "Destination Branch")}</option>
            {destCities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <textarea value={form.narration} onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))} rows={3} placeholder={s.t("narration_ph", "Note for the receiving office...")} className="w-full rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{s.t("cancel", "Cancel")}</Button>
          <Button disabled={saving} onClick={() => void submit()} className="gap-1.5">{saving && <Loader2 className="h-4 w-4 animate-spin" />} {s.t("send", "Send")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
