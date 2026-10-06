"use client";

import React from "react";
import { CheckCircle2, ClipboardCheck, Clock, RotateCcw, UserCheck } from "lucide-react";
import { t } from "@/lib/i18n/ui";

type Handover = {
  transfer_type?: string | null;
  status?: string | null;
  sender_user_id?: string | null;
  receiver_user_id?: string | null;
  sender_name?: string | null;
  receiver_name?: string | null;
  source_branch_name?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  instructions?: string | null;
  return_reason?: string | null;
} | null;

type Props = {
  lang: string;
  stage: "1B" | "1C";
  orderNo: string;
  handover: Handover;
  currentUserId: string | null | undefined;
  /** Human-readable items still to be done in this stage. */
  remaining: string[];
  /** The Road leg the truck is assigned to (1B only), e.g. "Leg 2: Karachi → Chaman". */
  legLabel?: string | null;
  busy: boolean;
  onAccept: () => void;
};

const fmt = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

/**
 * What the receiving user sees on an assigned stage: the order, who assigned it and when, whether it has
 * been accepted / completed / returned, what still has to be done — and a clear Accept action.
 */
export function CustomerOrderAssignmentCard({ lang, stage, orderNo, handover, currentUserId, remaining, legLabel, busy, onAccept }: Props) {
  const tt = (k: string, fb: string) => t(lang as never, ("com." + k) as never, fb);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const wantedType = stage === "1B" ? "truck_task" : "goods_verification";
  if (!handover || handover.transfer_type !== wantedType) return null;

  const status = String(handover.status || "pending");
  const mine = !!currentUserId && handover.receiver_user_id === currentUserId;
  const chip =
    status === "completed"
      ? { cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: tt("asg_st_completed", "Completed") }
      : status === "accepted"
      ? { cls: "bg-sky-100 text-sky-800 border-sky-300", icon: <UserCheck className="h-3.5 w-3.5" />, label: tt("asg_st_accepted", "Accepted") }
      : status === "returned"
      ? { cls: "bg-rose-100 text-rose-800 border-rose-300", icon: <RotateCcw className="h-3.5 w-3.5" />, label: tt("asg_st_returned", "Returned for correction") }
      : { cls: "bg-amber-100 text-amber-800 border-amber-300", icon: <Clock className="h-3.5 w-3.5" />, label: tt("asg_st_pending", "Awaiting acceptance") };

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 space-y-2.5 dark:border-indigo-900/60 dark:bg-indigo-950/20" data-testid={`assignment-card-${stage}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-indigo-900 dark:text-indigo-200">
          <ClipboardCheck className="h-4 w-4 text-indigo-600" />
          <span>{tt("asg_title", "Assignment")} — {stage}</span>
          <span className="font-mono normal-case" dir="ltr">{orderNo}</span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${chip.cls}`}>
          {chip.icon}
          {chip.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
        <div>
          <span className="block text-[10px] font-bold uppercase text-slate-400">{tt("asg_assigned_by", "Assigned by")}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{handover.sender_name || "—"}{handover.source_branch_name ? ` · ${handover.source_branch_name}` : ""}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase text-slate-400">{tt("asg_assigned_at", "Assigned on")}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200" dir="ltr">{fmt(handover.created_at)}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase text-slate-400">{tt("asg_assigned_to", "Assigned to")}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{handover.receiver_name || "—"}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase text-slate-400">{status === "completed" ? tt("asg_completed_on", "Completed on") : tt("asg_accepted_on", "Accepted on")}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200" dir="ltr">{fmt(status === "completed" ? handover.completed_at : handover.accepted_at)}</span>
        </div>
        {legLabel ? (
          <div className="col-span-2">
            <span className="block text-[10px] font-bold uppercase text-slate-400">{tt("asg_leg", "Route leg")}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{legLabel}</span>
          </div>
        ) : null}
        {handover.instructions ? (
          <div className="col-span-2">
            <span className="block text-[10px] font-bold uppercase text-slate-400">{tt("asg_instructions", "Instructions")}</span>
            <span className="text-slate-700 dark:text-slate-300">{handover.instructions}</span>
          </div>
        ) : null}
        {status === "returned" && handover.return_reason ? (
          <div className="col-span-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <span className="font-bold">{tt("asg_return_reason", "Return reason")}:</span> {handover.return_reason}
          </div>
        ) : null}
      </div>

      <div className="text-[11.5px]">
        <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">{tt("asg_remaining", "Still to do")}</span>
        {remaining.length === 0 ? (
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{tt("asg_nothing_left", "Nothing left — this stage is complete")}</span>
        ) : (
          <ul className="list-disc ps-4 space-y-0.5 text-slate-700 dark:text-slate-300">
            {remaining.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      {mine && status === "pending" ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>{tt("asg_accept", "Accept assignment")}</span>
          </button>
          <span className="text-[11px] text-slate-500">{tt("asg_accept_hint", "Accept this assignment before you confirm or complete the stage.")}</span>
        </div>
      ) : null}
    </div>
  );
}
