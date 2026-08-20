"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, RotateCcw, Trash2, KeyRound, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  actionType: "RESTORE" | "PERMANENT_DELETE";
  entityType: string;
  entityId: string;
  referenceNo?: string;
  onConfirm: (code: string, reason: string) => Promise<void>;
}

export function SecurityPinAuthDialog({
  isOpen,
  onClose,
  actionType,
  entityType,
  entityId,
  referenceNo,
  onConfirm
}: Props) {
  const [pinCode, setPinCode] = useState("");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDelete = actionType === "PERMANENT_DELETE";
  const expectedCode = isDelete ? "3636" : "9999";

  const handleExecute = async () => {
    setErrorMsg(null);

    const cleanPin = pinCode.trim();
    if (!cleanPin) {
      setErrorMsg(isDelete ? "Security PIN code is required." : "Authorization PIN code is required.");
      return;
    }

    if (isDelete && !reason.trim()) {
      setErrorMsg("Mandatory audit reason is required for permanent destruction of financial evidence.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(cleanPin, reason.trim() || (isDelete ? "Permanent Deletion executed" : "Restored to active ledger"));
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message || "Authorization failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isDelete ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}`}>
              {isDelete ? <ShieldAlert className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-black">
                {isDelete ? "Super Admin Permanent Delete (36 36)" : "Authorize Record Restore (99 99)"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isDelete
                  ? "Permanent deletion irreversibly removes the underlying database row."
                  : "Restore returns the record to active operations with complete audit history."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="p-2.5 bg-muted/50 rounded-lg border flex items-center justify-between font-mono">
            <span>Target Record:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {entityType} #{referenceNo || entityId}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Enter Security Authorization PIN Code:</span>
              <Badge variant="outline" className={isDelete ? "text-rose-600 border-rose-300" : "text-emerald-600 border-emerald-300"}>
                {isDelete ? "Required: 3636" : "Required: 9999 or 3636"}
              </Badge>
            </label>
            <Input
              type="text"
              placeholder={isDelete ? "Enter 3636" : "Enter 9999"}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              className="text-center font-mono text-base tracking-widest font-bold"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isDelete ? "Audit Deletion Reason (Mandatory):" : "Restoration Reason (Optional):"}
            </label>
            <Input
              placeholder={isDelete ? "State reason for permanent deletion..." : "Reason for returning to active state..."}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={isSubmitting}
            className={`text-xs font-bold gap-1.5 ${
              isDelete ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {isDelete ? <Trash2 className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
            {isSubmitting ? "Processing..." : isDelete ? "Confirm Permanent Delete (3636)" : "Confirm Restore (9999)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
