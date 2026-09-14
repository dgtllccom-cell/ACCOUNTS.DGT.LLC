"use client";

import { useEffect, useState } from "react";
import {
  Send,
  UserCheck,
  Clock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost } from "@/lib/api/client";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";

export type TaskHandoverModalProps = {
  open: boolean;
  onClose: () => void;
  orderReference: string;
  sourceTable?: string;
  sourceId?: string;
  targetUrl: string;
  currentStage?: string;
  defaultTask?: string;
  sourceCountryId: string;
  sourceCountryBranchId?: string | null;
  sourceCityBranchId?: string | null;
  domain?: "shipping" | "business" | "both";
  customerPartyName?: string | null;
  onSuccess?: () => void;
  lang?: string | null;
};

type AssigneeUser = {
  id: string;
  userCode: string;
  name: string;
  role: string;
  countryId: string | null;
  countryName: string;
  countryBranchId: string | null;
  countryBranchName: string;
  cityBranchId: string | null;
  cityBranchName: string;
  operationalDomain: string;
};

export function TaskHandoverModal({
  open,
  onClose,
  orderReference,
  sourceTable = "clearing_customer_orders",
  sourceId,
  targetUrl,
  currentStage,
  defaultTask,
  sourceCountryId,
  sourceCountryBranchId,
  sourceCityBranchId,
  domain = "shipping",
  customerPartyName,
  onSuccess,
  lang,
}: TaskHandoverModalProps) {
  const s = useErpScreen("thm", lang);

  const [assignees, setAssignees] = useState<AssigneeUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [requestedTask, setRequestedTask] = useState(defaultTask || "");
  const [instruction, setInstruction] = useState("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRequestedTask(defaultTask || "");
    setError(null);

    async function loadEligibleUsers() {
      setLoadingUsers(true);
      try {
        const q = new URLSearchParams();
        if (domain) q.set("domain", domain);
        const res = await apiGet<{ users: AssigneeUser[] }>(`/api/erp/users/eligible-assignees?${q.toString()}`);
        setAssignees(res.users || []);
        if (res.users?.length && !selectedUserId) {
          setSelectedUserId(res.users[0].id);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load eligible users.");
      } finally {
        setLoadingUsers(false);
      }
    }

    void loadEligibleUsers();
  }, [open, domain, defaultTask]);

  const selectedAssignee = assignees.find((u) => u.id === selectedUserId);

  async function handleSubmit() {
    if (!selectedUserId) {
      setError(s.t("err_select_user", "Please select an authorized user to receive this task."));
      return;
    }
    if (!requestedTask.trim()) {
      setError(s.t("err_task_required", "Please specify the required task or stage."));
      return;
    }
    if (!instruction.trim()) {
      setError(s.t("err_instruction_required", "Please provide remarks or instructions for the receiving user."));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const destCountryId = selectedAssignee?.countryId || sourceCountryId;
      const destCountryBranchId = selectedAssignee?.countryBranchId || sourceCountryBranchId || null;
      const destCityBranchId = selectedAssignee?.cityBranchId || sourceCityBranchId || null;

      await apiPost("/api/erp/transfer-center", {
        transferType: domain === "shipping" ? "shipping_handover" : "purchase_booking",
        sourceCountryId,
        sourceCountryBranchId: sourceCountryBranchId || null,
        sourceCityBranchId: sourceCityBranchId || null,
        destCountryId,
        destCountryBranchId,
        destCityBranchId,
        receiverUserId: selectedUserId,
        sourceTable,
        sourceId: sourceId || null,
        orderReference,
        customerPartyName: customerPartyName || null,
        narration: requestedTask,
        remarks: instruction,
        metadata: {
          targetUrl,
          requestedTask,
          currentStage: currentStage || "in_progress",
          priority,
          orderReference,
          customerPartyName,
          transferredAt: new Date().toISOString(),
        },
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to transfer task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/25">
              <Send className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                {s.t("modal_title", "User-to-User Work Transfer & Handover")}
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {s.t("modal_subtitle", "Delegate the next stage to an authorized user on canonical ERP record")}{" "}
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{orderReference}</span>
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Target Record Info Box */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="font-bold text-slate-700 dark:text-slate-300">{orderReference}</span>
            </div>
            {currentStage && (
              <Badge variant="outline" className="text-[10px] font-semibold">
                {s.t("current_stage", "Current Stage")}: {currentStage}
              </Badge>
            )}
          </div>

          {/* 1. Next User / Assignee Selector */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {s.t("assign_to_user", "Next User / Assignee *")}
            </label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{s.t("loading_assignees", "Loading authorized assignees...")}</span>
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.userCode}) — {u.role} [{u.cityBranchName || u.countryBranchName || u.countryName}]
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              {s.t("rbac_scope_note", "Filtered strictly to authorized users within your branch and operational domain.")}
            </p>
          </div>

          {/* 2. Required Task / Stage */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {s.t("required_task", "Required Task / Next Stage *")}
            </label>
            <Input
              value={requestedTask}
              onChange={(e) => setRequestedTask(e.target.value)}
              placeholder={s.t("task_ph", "e.g. Complete Truck Details, Customs Clearing, Goods Verification")}
              className="text-xs"
            />
          </div>

          {/* 3. Priority Selection */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {s.t("priority", "Priority")}
            </label>
            <div className="flex items-center gap-2">
              {(["normal", "high", "urgent"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-lg border py-1.5 text-xs font-bold capitalize transition ${
                    priority === p
                      ? p === "urgent"
                        ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        : p === "high"
                        ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        : "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Instructions / Remarks */}
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {s.t("instructions", "Instructions / Message for Assignee *")}
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              placeholder={s.t("instruction_ph", "e.g. Please complete the Truck Details for this order.")}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {s.t("cancel", "Cancel")}
          </Button>
          <Button size="sm" onClick={() => void handleSubmit()} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span>{s.t("transfer_action", "Transfer Task")}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
