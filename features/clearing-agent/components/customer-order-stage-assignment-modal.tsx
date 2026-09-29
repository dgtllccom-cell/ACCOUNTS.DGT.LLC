"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  Globe2,
  MapPin,
  RefreshCw,
  Truck,
  User,
  Users,
  X
} from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

interface CustomerOrderStageAssignmentModalProps {
  isOpen: boolean;
  orderId: string;
  orderNo: string;
  stage: "1A_TO_1B" | "1B_TO_1C";
  truckData?: Record<string, any> | null;
  countries: { id: string; name: string }[];
  countryBranches: { id: string; name: string; countryId: string; code?: string | null }[];
  cityBranches: { id: string; name: string; countryBranchId: string; code?: string | null }[];
  assignableUsers: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: (assignedUserName: string) => void;
  lang: SupportedLanguage;
}

export function CustomerOrderStageAssignmentModal({
  isOpen,
  orderId,
  orderNo,
  stage,
  truckData,
  countries,
  countryBranches,
  cityBranches,
  assignableUsers,
  onClose,
  onSuccess,
  lang
}: CustomerOrderStageAssignmentModalProps) {
  const [countryId, setCountryId] = useState("");
  const [countryBranchId, setCountryBranchId] = useState("");
  const [cityBranchId, setCityBranchId] = useState("");
  const [userRole, setUserRole] = useState(
    stage === "1A_TO_1B" ? "truck_desk" : "goods_clerk"
  );
  const [selectedUserId, setSelectedUserId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, ("com." + key) as never, fallback);

  const filteredCountryBranches = useMemo(() => {
    if (!countryId) return countryBranches;
    return countryBranches.filter((b) => b.countryId === countryId);
  }, [countryBranches, countryId]);

  const filteredCityBranches = useMemo(() => {
    if (!countryBranchId) return cityBranches;
    return cityBranches.filter((b) => b.countryBranchId === countryBranchId);
  }, [cityBranches, countryBranchId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError(tt("err_select_assignee", "Please select a responsible user."));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const assignedUser = assignableUsers.find((u) => u.id === selectedUserId);
      const assignedUserName = assignedUser?.name || "Assigned User";

      if (stage === "1A_TO_1B") {
        const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/workflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "handover_1a",
            toUserId: selectedUserId,
            toCountryId: countryId || null,
            toCountryBranchId: countryBranchId || null,
            toCityBranchId: cityBranchId || null,
            instructions: instructions.trim() || "Stage 1A Complete — Truck Confirmation Required",
            dueDate: dueDate || null
          })
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to assign Stage 1B.");
      } else {
        // Stage 1B -> 1C
        const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/workflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm_truck",
            continueMyself: false,
            goodsAssigneeId: selectedUserId,
            destCountryId: countryId || null,
            destCountryBranchId: countryBranchId || null,
            destCityBranchId: cityBranchId || null,
            instructions: instructions.trim() || "Truck Confirmed — Goods Entry Assigned to You",
            dueDate: dueDate || null,
            truckData: truckData || {}
          })
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to assign Stage 1C.");
      }

      onSuccess(assignedUserName);
      onClose();
    } catch (err: any) {
      console.error("Stage assignment error:", err);
      setError(err?.message || "Failed to assign stage.");
    } finally {
      setSubmitting(false);
    }
  };

  const isTruckStage = stage === "1A_TO_1B";

  return (
    <SimpleModal
      title={
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <Users className="h-5 w-5" />
          <span>
            {isTruckStage
              ? tt("assign_truck_confirmation_title", "Assign Stage 1B — Truck Confirmation")
              : tt("assign_goods_entry_title", "Assign Stage 1C — Goods Entry")}
          </span>
          <span className="font-mono text-xs font-bold text-slate-500">[{orderNo}]</span>
        </div>
      }
      onClose={onClose}
      className="w-[95vw] max-w-xl rounded-2xl shadow-2xl overflow-hidden"
    >
      <form onSubmit={handleSubmit} dir={isRtl ? "rtl" : "ltr"} className="p-4 sm:p-5 space-y-4 text-xs">
        {/* Stage Purpose Notification Banner */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            {isTruckStage ? (
              <Truck className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            ) : (
              <Boxes className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span>
              {isTruckStage
                ? tt("stage_1a_complete_notice", "Stage 1A Complete — Assigning Truck Confirmation")
                : tt("stage_1b_complete_notice", "Stage 1B Complete — Assigning Goods Entry")}
            </span>
          </div>
          <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
            {isTruckStage
              ? tt("stage_1b_assign_desc", "The recipient will receive the notification: 'Stage 1A Complete — Truck Confirmation Required' in their tasks and order queue.")
              : tt("stage_1c_assign_desc", "The recipient will receive the notification: 'Truck Confirmed — Goods Entry Assigned to You' in their tasks and order queue.")}
          </p>
        </div>

        {/* Form Grid */}
        <div className="space-y-3">
          {/* Row 1: Country & Branch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Globe2 className="h-3 w-3 text-slate-400" />
                <span>{tt("country", "Country")}</span>
              </label>
              <select
                value={countryId}
                onChange={(e) => {
                  setCountryId(e.target.value);
                  setCountryBranchId("");
                  setCityBranchId("");
                }}
                className="w-full h-8.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">— {tt("select_country", "Select Country")} —</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Building2 className="h-3 w-3 text-slate-400" />
                <span>{tt("branch", "Branch / Desk")}</span>
              </label>
              <select
                value={countryBranchId}
                onChange={(e) => setCountryBranchId(e.target.value)}
                className="w-full h-8.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">— {tt("select_branch", "Select Branch")} —</option>
                {filteredCountryBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Department / Role & Responsible User */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                {tt("user_role_dept", "User Role / Department")}
              </label>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="w-full h-8.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {isTruckStage ? (
                  <>
                    <option value="truck_desk">{tt("role_truck_desk", "Truck / Fleet Desk")}</option>
                    <option value="transport_dispatcher">{tt("role_transport_dispatcher", "Transport Dispatcher")}</option>
                    <option value="clearing_agent">{tt("role_clearing_agent", "Clearing Agent / Officer")}</option>
                    <option value="general_staff">{tt("role_general_staff", "Branch Staff")}</option>
                  </>
                ) : (
                  <>
                    <option value="goods_clerk">{tt("role_goods_clerk", "Goods & Manifest Clerk")}</option>
                    <option value="warehouse_incharge">{tt("role_warehouse_incharge", "Warehouse Incharge")}</option>
                    <option value="clearing_agent">{tt("role_clearing_agent", "Clearing Agent / Officer")}</option>
                    <option value="general_staff">{tt("role_general_staff", "Branch Staff")}</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <User className="h-3 w-3 text-indigo-500" />
                <span>{tt("responsible_user", "Responsible User")} *</span>
              </label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full h-8.5 rounded-xl border border-indigo-200 bg-white px-2.5 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">— {tt("select_user", "Select User")} —</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Operational Instructions / Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tt("operational_instructions", "Operational Instructions / Note")}
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={
                isTruckStage
                  ? tt("ph_inst_truck", "e.g. Please confirm 40ft Flatbed trailer and arrange driver verification before 3 PM...")
                  : tt("ph_inst_goods", "e.g. Verify goods gross weight against packing list and assign to Warehouse Bay #3...")
              }
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-100"
            />
          </div>

          {/* Row 4: Required Completion Date & Time (Optional) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span>{tt("required_completion_time", "Required Completion Date & Time (Optional)")}</span>
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-8.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {/* Modal Buttons */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {tt("cancel", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedUserId}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            <span>
              {isTruckStage
                ? tt("confirm_assign_truck", "Assign Stage 1B to User")
                : tt("confirm_assign_goods", "Assign Stage 1C to User")}
            </span>
          </button>
        </div>
      </form>
    </SimpleModal>
  );
}
