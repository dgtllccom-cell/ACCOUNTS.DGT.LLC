"use client";

import React, { useState } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw, X } from "lucide-react";
import { SimpleModal } from "@/components/ui/simple-modal";
import { t } from "@/lib/i18n/ui";
import type { SupportedLanguage } from "@/lib/i18n/languages";

interface CustomerOrderReturnCorrectionModalProps {
  isOpen: boolean;
  orderId: string;
  orderNo: string;
  currentStage: "1B" | "1C";
  onClose: () => void;
  onSuccess: (reason: string) => void;
  lang: SupportedLanguage;
}

export function CustomerOrderReturnCorrectionModal({
  isOpen,
  orderId,
  orderNo,
  currentStage,
  onClose,
  onSuccess,
  lang
}: CustomerOrderReturnCorrectionModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = (key: string, fallback: string) => t(lang, ("com." + key) as never, fallback);

  if (!isOpen) return null;

  const targetStage = currentStage === "1B" ? "1A" : "1B";
  const targetStageLabel = currentStage === "1B"
    ? tt("stage_1a_title", "Stage 1A (Customer & Route Setup)")
    : tt("stage_1b_title", "Stage 1B (Truck & Transport Desk)");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError(tt("err_reason_mandatory", "A mandatory reason for correction is required."));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/erp/clearing-agent/customer-order/${orderId}/workflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "return_for_correction",
          targetStage,
          reason: cleanReason
        })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to return order for correction.");
      }

      onSuccess(cleanReason);
      onClose();
    } catch (err: any) {
      console.error("Return for correction failed:", err);
      setError(err?.message || "Failed to submit return request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SimpleModal
      title={
        <div className="flex items-center gap-2 text-rose-600">
          <AlertTriangle className="h-5 w-5" />
          <span>{tt("return_for_correction_title", "Return Order for Correction")}</span>
        </div>
      }
      onClose={onClose}
      className="w-[95vw] max-w-lg rounded-2xl shadow-2xl overflow-hidden"
    >
      <form onSubmit={handleSubmit} dir={isRtl ? "rtl" : "ltr"} className="p-4 sm:p-5 space-y-4">
        {/* Warning Banner */}
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4 text-rose-600 shrink-0" />
            <span>
              {tt("returning_to_stage", "Returning Order {orderNo} to {targetStage}").replace("{orderNo}", orderNo).replace("{targetStage}", targetStageLabel)}
            </span>
          </div>
          <p className="text-[11px] text-rose-700 dark:text-rose-300">
            {tt(
              "return_notice_desc",
              "The order will be moved back with 'Returned for Correction' status, and the responsible user will be notified with your specific reason below."
            )}
          </p>
        </div>

        {/* Mandatory Reason Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
            {tt("mandatory_correction_reason", "Reason for Return & Correction Instructions")} *
          </label>
          <textarea
            required
            rows={4}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder={
              currentStage === "1B"
                ? tt("ph_return_1b_to_1a", "Explain what is incorrect in Stage 1A (e.g., incorrect customer, wrong loading port, route leg needs adjustment)...")
                : tt("ph_return_1c_to_1b", "Explain what is incorrect in Stage 1B (e.g., truck number discrepancy, driver details missing, loading terminal incorrect)...")
            }
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 outline-none transition focus:border-rose-500 focus:ring-1 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-100"
          />
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {tt("min_reason_note", "Please provide clear and complete details so the user can quickly rectify the issue.")}
          </p>
        </div>

        {error ? (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {/* Modal Action Buttons */}
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
            disabled={submitting || !reason.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition"
          >
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            <span>{tt("confirm_return_button", "Confirm Return for Correction")}</span>
          </button>
        </div>
      </form>
    </SimpleModal>
  );
}
