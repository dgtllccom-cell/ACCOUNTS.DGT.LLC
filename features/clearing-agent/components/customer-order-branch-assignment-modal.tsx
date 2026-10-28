"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  FileText,
  MapPin,
  Route,
  Truck,
  User,
  Users,
  X
} from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export interface BranchAssignmentUser {
  id: string;
  name: string;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  countryId?: string | null;
  role?: string | null;
}

export interface CustomerOrderBranchAssignmentModalProps {
  isOpen: boolean;
  type: "loading" | "receiving";
  branchId: string;
  branchName: string;
  orderNo: string;
  customerName: string;
  originText: string;
  destinationText: string;
  transportMode: string;
  assignableUsers: BranchAssignmentUser[];
  initialUserId?: string;
  initialInstructions?: string;
  onClose: () => void;
  onConfirm: (userId: string, userName: string, instructions: string) => void;
  lang: SupportedLanguage;
}

export function CustomerOrderBranchAssignmentModal({
  isOpen,
  type,
  branchId,
  branchName,
  orderNo,
  customerName,
  originText,
  destinationText,
  transportMode,
  assignableUsers,
  initialUserId = "",
  initialInstructions = "",
  onClose,
  onConfirm,
  lang
}: CustomerOrderBranchAssignmentModalProps) {
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [validationError, setValidationError] = useState<string | null>(null);

  const tt = (key: string, fallback: string) => t(lang, ("com." + key) as never, fallback);

  useEffect(() => {
    setSelectedUserId(initialUserId);
    setInstructions(
      initialInstructions ||
        (type === "loading"
          ? `Please handle origin export customs formalities, seal inspection, and dispatch clearance for Order ${orderNo || "Draft"}.`
          : `Please coordinate import clearance, customs release, and destination delivery formalities for Order ${orderNo || "Draft"}.`)
    );
    setValidationError(null);
  }, [isOpen, initialUserId, initialInstructions, type, orderNo]);

  // Filter eligible users for the chosen branch
  const eligibleUsers = useMemo(() => {
    if (!branchId) return assignableUsers;
    const branchSpecific = assignableUsers.filter(
      (u) => u.countryBranchId === branchId || u.cityBranchId === branchId
    );
    // If branch has specifically assigned users, return them; otherwise allow all active users
    return branchSpecific.length > 0 ? branchSpecific : assignableUsers;
  }, [assignableUsers, branchId]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedUserId) {
      setValidationError(tt("select_officer_required", "Please select an officer for this assignment."));
      return;
    }
    const chosenUser = eligibleUsers.find((u) => u.id === selectedUserId) || assignableUsers.find((u) => u.id === selectedUserId);
    const chosenName = chosenUser?.name || "Assigned Officer";
    onConfirm(selectedUserId, chosenName, instructions.trim());
  };

  const isOrigin = type === "loading";

  return (
    <SimpleModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-xs ${isOrigin ? "bg-blue-600" : "bg-purple-600"}`}>
            <Building2 className="h-4 w-4" />
          </span>
          <span>
            {isOrigin
              ? tt("assign_loading_customs_branch", "Assign Loading Customs (Origin) — Branch Officer")
              : tt("assign_receiving_customs_branch", "Assign Receiving Customs (Destination) — Branch Officer")}
          </span>
        </div>
      }
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Branch Context Banner */}
        <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
          isOrigin
            ? "border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
            : "border-purple-200 bg-purple-50/70 dark:border-purple-900/60 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200"
        }`}>
          <div className="flex items-center gap-2.5">
            <Building2 className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                {isOrigin ? tt("origin_clearance_branch", "Origin Clearance Branch") : tt("dest_clearance_branch", "Destination Clearance Branch")}
              </p>
              <h4 className="font-bold text-xs sm:text-sm">{branchName || tt("selected_branch", "Selected Branch")}</h4>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/80 dark:bg-slate-900/80 border border-current shadow-2xs">
            {isOrigin ? tt("origin_badge", "Origin / Export") : tt("dest_badge", "Dest / Import")}
          </span>
        </div>

        {/* Short Order Summary Card */}
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-850 space-y-2">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-200/60 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            <FileText className="h-3.5 w-3.5" />
            <span>{tt("order_summary_title", "Order Summary")}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <span className="block text-[11px] font-semibold text-slate-500">{tt("order_no", "Order No")}</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{orderNo || "Draft Order"}</span>
            </div>
            <div>
              <span className="block text-[11px] font-semibold text-slate-500">{tt("customer_name", "Customer / Party")}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block max-w-[150px]">{customerName || "—"}</span>
            </div>
            <div>
              <span className="block text-[11px] font-semibold text-slate-500">{tt("transport_mode", "Transport Mode")}</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 capitalize">{transportMode || "By Road"}</span>
            </div>
            <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-200/50 dark:border-slate-800 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="font-bold text-sky-700 dark:text-sky-300">
                {originText || "Origin"}
              </span>
              <span className="text-slate-400 font-bold">➔</span>
              <span className="font-bold text-purple-700 dark:text-purple-300">
                {destinationText || "Destination"}
              </span>
            </div>
          </div>
        </div>

        {/* Eligible Users Picker */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
            {tt("assign_to_officer", "Assign to Branch Officer")} *
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value);
              setValidationError(null);
            }}
            className="w-full h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 shadow-2xs focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">{tt("choose_branch_officer", "Choose branch officer...")}</option>
            {eligibleUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.role ? `(${u.role})` : ""}
              </option>
            ))}
          </select>
          {validationError && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{validationError}</p>
          )}
          <p className="text-[11px] text-slate-500">
            {eligibleUsers.length > 0
              ? tt("users_filtered_note", `Showing ${eligibleUsers.length} available officer(s) eligible for ${branchName || "this branch"}.`)
              : tt("no_users_found", "No specific branch officers configured. Select any available user.")}
          </p>
        </div>

        {/* Assignment Instructions */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
            {tt("instructions_to_officer", "Instructions / Special Notes")}
          </label>
          <textarea
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={tt("instructions_placeholder", "Enter specific customs instructions, transit requirements, or priority notes...")}
            className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 shadow-2xs focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs transition"
          >
            {tt("cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black text-white shadow-md transition ${
              isOrigin ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/25" : "bg-purple-600 hover:bg-purple-700 shadow-purple-600/25"
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{tt("confirm_assignment_btn", "Confirm Assignment")}</span>
          </button>
        </div>
      </div>
    </SimpleModal>
  );
}
