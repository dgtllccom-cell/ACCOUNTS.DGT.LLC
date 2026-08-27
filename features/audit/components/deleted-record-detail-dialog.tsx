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
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  RotateCcw,
  History,
  Eye,
  Calendar,
  User,
  MapPin,
  FileText,
  AlertTriangle,
  Layers,
  ShieldAlert,
  Hash,
  Clock
} from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

interface DeletedRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  reference_no?: string;
  user_name?: string;
  user_role?: string;
  country_name?: string;
  branch_name?: string;
  ip_address?: string;
  device_session?: string;
  reason?: string;
  deleted_at: string;
  previous_snapshot?: any;
  current_snapshot?: any;
  diff_changes?: any;
  version_number?: number;
}

interface Props {
  record: DeletedRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (entityType: string, entityId: string, referenceNo?: string) => void;
  onPermanentDelete: (entityType: string, entityId: string, referenceNo?: string) => void;
  onOpenTimeline: (entityType: string, entityId: string, referenceNo?: string) => void;
}

export function DeletedRecordDetailDialog({
  record,
  isOpen,
  onClose,
  onRestore,
  onPermanentDelete,
  onOpenTimeline
}: Props) {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);

  if (!record) return null;

  const snapshot = record.previous_snapshot || record.current_snapshot || {};
  const hasSnapshot = typeof snapshot === "object" && snapshot !== null && Object.keys(snapshot).length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded-lg">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{tt("aud.deleted_snapshot", "Deleted Record Snapshot:")}</span>
                  <span className="font-mono text-rose-700 dark:text-rose-400">
                    {record.reference_no || record.entity_id}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {tt("aud.archived_desc", "Complete archived state preserved in Super Admin Vault prior to soft deletion.")}
                </DialogDescription>
              </div>
            </div>
            <Badge className="bg-rose-600 text-white font-bold text-xs tracking-wider">
              {tt("aud.archived_badge", "DELETED (ARCHIVED)")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border">
            <div>
              <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-sky-600" />
                {tt("aud.entity_type", "Entity Type")}
              </div>
              <div className="font-bold text-slate-800 dark:text-slate-200 capitalize mt-0.5">
                {record.entity_type.replace(/_/g, " ")}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                <Hash className="h-3.5 w-3.5 text-sky-600" />
                {tt("aud.ref_number", "Reference Number")}
              </div>
              <div className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                {record.reference_no || record.entity_id}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-rose-600" />
                {tt("aud.deleted_at", "Deleted At")}
              </div>
              <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                {new Date(record.deleted_at).toLocaleString()}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-blue-600" />
                {tt("aud.deleted_by", "Deleted By User")}
              </div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {record.user_name || "Super Admin"} ({record.user_role || "Admin"})
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                {tt("aud.country_branch", "Country / Branch")}
              </div>
              <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                {record.country_name || "Global"} / {record.branch_name || "Main Branch"}
              </div>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                {tt("aud.session_ip", "Session / IP")}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                {record.ip_address || "127.0.0.1"} ({record.device_session || "Web Desktop"})
              </div>
            </div>
          </div>

          {/* Deletion Reason Alert */}
          <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg">
            <div className="text-[11px] font-bold uppercase text-rose-800 dark:text-rose-300 flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              {tt("aud.deletion_reason", "Deletion Reason Stated by Operator:")}
            </div>
            <p className="text-xs text-rose-900 dark:text-rose-200 italic font-medium">
              "{record.reason || "Soft deleted from operational view and archived in Super Admin Vault."}"
            </p>
          </div>

          {/* Snapshot Data Presentation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <FileText className="h-4 w-4 text-sky-600" />
                {tt("aud.original_snapshot", "Original Record Data Snapshot")}
              </h3>
              <span className="text-[11px] text-muted-foreground">{tt("aud.version_label", "Version")} #{record.version_number || 1} {tt("aud.version_state", "State")}</span>
            </div>

            {hasSnapshot ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border bg-slate-50/50 dark:bg-slate-900/50">
                  {Object.entries(snapshot).map(([key, val], idx) => {
                    const displayVal =
                      typeof val === "object" && val !== null ? JSON.stringify(val, null, 2) : String(val ?? "—");
                    return (
                      <div key={idx} className="p-2.5 flex flex-col border-b last:border-b-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs font-medium font-mono text-slate-800 dark:text-slate-200 mt-0.5 break-all whitespace-pre-wrap">
                          {displayVal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-6 border rounded-lg text-center text-muted-foreground bg-muted/20">
                {tt("aud.no_snapshot", "No structured field snapshot captured for this legacy row.")}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenTimeline(record.entity_type, record.entity_id, record.reference_no)}
            className="text-xs text-sky-600 hover:text-sky-700 gap-1.5"
          >
            <History className="h-3.5 w-3.5" />
            {tt("aud.view_history", "View Version History")} (+)
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestore(record.entity_type, record.entity_id, record.reference_no)}
              className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1.5 border-emerald-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {tt("aud.restore_entry", "Restore Entry")} (Code: 9999 / 3636)
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => onPermanentDelete(record.entity_type, record.entity_id, record.reference_no)}
              className="text-xs gap-1.5 bg-rose-600 hover:bg-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {tt("aud.hard_delete", "Hard Delete")} (Code: 3636)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
