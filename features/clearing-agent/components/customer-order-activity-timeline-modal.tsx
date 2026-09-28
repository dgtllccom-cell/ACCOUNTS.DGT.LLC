"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  Truck,
  User,
  X
} from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

export type TimelineEvent = {
  id: string;
  stage: string;
  stageName: string;
  action: string;
  actorName: string;
  targetUserName?: string | null;
  countryName?: string | null;
  branchName?: string | null;
  createdAt: string;
  status: "completed" | "pending" | "returned" | "in_progress" | string;
  returnReason?: string | null;
  notes?: string | null;
};

interface CustomerOrderActivityTimelineModalProps {
  isOpen: boolean;
  orderId: string | null;
  orderNo?: string | null;
  onClose: () => void;
  lang: SupportedLanguage;
}

export function CustomerOrderActivityTimelineModal({
  isOpen,
  orderId,
  orderNo,
  onClose,
  lang
}: CustomerOrderActivityTimelineModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [orderSummary, setOrderSummary] = useState<any>(null);

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  const fetchTimeline = async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/workflow`);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to load activity timeline.");
      }
      setTimeline(json.data.timeline || []);
      setOrderSummary(json.data.order || null);
    } catch (err: any) {
      console.error("Error fetching timeline:", err);
      setError(err?.message || "Could not fetch activity timeline.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      void fetchTimeline();
    } else {
      setTimeline([]);
      setOrderSummary(null);
      setError(null);
    }
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const tt = (key: string, fallback: string) => t(lang, ("com." + key) as never, fallback);

  const getStageIcon = (stage: string, action: string, status: string) => {
    if (status === "returned" || action.toLowerCase().includes("return")) {
      return <AlertTriangle className="h-4 w-4 text-rose-500" />;
    }
    if (stage === "1A" || action.toLowerCase().includes("create")) {
      return <User className="h-4 w-4 text-blue-500" />;
    }
    if (stage === "1B" || action.toLowerCase().includes("truck")) {
      return <Truck className="h-4 w-4 text-amber-500" />;
    }
    if (stage === "1C" || action.toLowerCase().includes("goods")) {
      return <Boxes className="h-4 w-4 text-emerald-500" />;
    }
    return <Activity className="h-4 w-4 text-slate-500" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            <span>{tt("status_completed", "Completed")}</span>
          </span>
        );
      case "returned":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300">
            <AlertTriangle className="h-3 w-3" />
            <span>{tt("status_returned", "Returned for Correction")}</span>
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300">
            <Clock className="h-3 w-3" />
            <span>{tt("status_pending", "Pending / Assigned")}</span>
          </span>
        );
    }
  };

  return (
    <SimpleModal
      title={
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          <span>{tt("order_timeline_title", "Order Activity Timeline & Audit Trail")}</span>
          <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
            [{orderNo || orderSummary?.order_no || orderId?.slice(0, 8)}]
          </span>
        </div>
      }
      onClose={onClose}
      className="w-[95vw] max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
    >
      <div dir={isRtl ? "rtl" : "ltr"} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Header Overview Card */}
        {orderSummary ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">
                {tt("customer_account", "Customer / Party")}
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {orderSummary.customer_name || "-"}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {orderSummary.route_name || [orderSummary.loading_country_name, orderSummary.receiving_country_name].filter(Boolean).join(" → ") || "Direct Route"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchTimeline()}
                disabled={loading}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                title={tt("refresh", "Refresh")}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Loading / Error States */}
        {loading && timeline.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="h-6 w-6 mx-auto animate-spin text-blue-600" />
            <p className="text-xs">{tt("loading_timeline", "Loading activity audit trail...")}</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : timeline.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            {tt("no_timeline_events", "No activity recorded for this order yet.")}
          </div>
        ) : (
          /* Chronological Timeline List */
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {timeline.map((ev, idx) => (
              <div key={ev.id || idx} className="relative group">
                {/* Node icon */}
                <div className="absolute -left-6 sm:-left-8 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 group-hover:border-blue-500 shadow-2xs">
                  {getStageIcon(ev.stage, ev.action, ev.status)}
                </div>

                {/* Event Card */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-850 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 text-[9px] font-black uppercase text-blue-700 dark:text-blue-300">
                        {ev.stage || "STG"}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {ev.action}
                      </span>
                    </div>
                    {getStatusBadge(ev.status)}
                  </div>

                  {/* Users / Branch Info */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" />
                      <span>{tt("by_label", "By:")}</span>
                      <strong className="text-slate-700 dark:text-slate-300">{ev.actorName || "User"}</strong>
                    </span>

                    {ev.targetUserName ? (
                      <span className="flex items-center gap-1">
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span>{tt("to_label", "To:")}</span>
                        <strong className="text-blue-600 dark:text-blue-400">{ev.targetUserName}</strong>
                      </span>
                    ) : null}

                    {ev.branchName ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        <span>{ev.branchName}</span>
                      </span>
                    ) : null}

                    <span className="flex items-center gap-1 ml-auto text-[10px] font-mono opacity-80">
                      <Clock className="h-2.5 w-2.5" />
                      <span>
                        {ev.createdAt
                          ? new Date(ev.createdAt).toLocaleString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "-"}
                      </span>
                    </span>
                  </div>

                  {/* Return Reason Box if returned */}
                  {ev.returnReason ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-2.5 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300 text-[11px]">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{tt("correction_reason_label", "Return / Correction Reason:")}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed font-medium pl-5">{ev.returnReason}</p>
                    </div>
                  ) : null}

                  {/* Notes / Instructions */}
                  {ev.notes && !ev.returnReason ? (
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <p className="italic">“{ev.notes}”</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {tt("close", "Close")}
          </button>
        </div>
      </div>
    </SimpleModal>
  );
}
