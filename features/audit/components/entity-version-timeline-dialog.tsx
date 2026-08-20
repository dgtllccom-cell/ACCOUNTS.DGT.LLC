"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History,
  ChevronDown,
  ChevronRight,
  User,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileText
} from "lucide-react";

interface VersionEvent {
  id: string;
  version_number: number;
  action_type: string;
  diff_changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  previous_snapshot?: any;
  current_snapshot?: any;
  user_name?: string;
  user_role?: string;
  country_name?: string;
  branch_name?: string;
  ip_address?: string;
  reason?: string;
  created_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  referenceNo?: string;
  language?: string;
}

export function EntityVersionTimelineDialog({
  isOpen,
  onClose,
  entityType,
  entityId,
  referenceNo,
  language = "en"
}: Props) {
  const [timeline, setTimeline] = useState<VersionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Record<number, boolean>>({});

  const isRtl = language === "ur" || language === "ar" || language === "fa" || language === "ps";

  useEffect(() => {
    if (isOpen && entityType && entityId) {
      fetchTimeline();
    }
  }, [isOpen, entityType, entityId]);

  const fetchTimeline = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/erp/audit/version-timeline?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
      );
      const data = await res.json();
      if (data.success) {
        setTimeline(data.timeline || []);
      }
    } catch (e) {
      console.error("Failed to load version timeline", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (versionNum: number) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [versionNum]: !prev[versionNum]
    }));
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">Original Created</Badge>;
      case "EDIT":
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700">Edited</Badge>;
      case "SOFT_DELETE":
        return <Badge className="bg-rose-600 text-white hover:bg-rose-700">Soft Deleted</Badge>;
      case "RESTORE":
        return <Badge className="bg-amber-600 text-white hover:bg-amber-700">Restored</Badge>;
      case "POST":
        return <Badge className="bg-purple-600 text-white hover:bg-purple-700">Posted Voucher</Badge>;
      case "APPROVE":
        return <Badge className="bg-indigo-600 text-white hover:bg-indigo-700">Approved</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-sky-600" />
              <DialogTitle className="text-lg font-bold">
                {isRtl ? "مکمل انٹری ورژن و ترمیم کی ٹائم لائن" : "Complete Entry Version & Edit Timeline"}
              </DialogTitle>
            </div>
            {referenceNo && (
              <Badge variant="secondary" className="font-mono text-xs">
                Ref: {referenceNo}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {isRtl
              ? `ماڈیول: ${entityType} | شناختی نمبر: ${entityId}`
              : `Entity: ${entityType} | ID: ${entityId}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
            {isRtl ? "تاریخچہ لوڈ ہو رہا ہے..." : "Loading version history..."}
          </div>
        ) : timeline.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {isRtl ? "کوئی پچھلی ترمیم ریکارڈ نہیں ہوئی۔" : "No previous edit history recorded for this entry."}
          </div>
        ) : (
          <div className="relative border-l-2 border-sky-200 dark:border-sky-800 ml-4 space-y-6 my-4">
            {timeline.map((event, idx) => {
              const isExpanded = !!expandedVersions[event.version_number];
              const dateStr = new Date(event.created_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric"
              });
              const timeStr = new Date(event.created_at).toLocaleTimeString();

              return (
                <div key={event.id || idx} className="relative pl-6">
                  {/* Timeline Dot */}
                  <div className="absolute -left-2.5 top-1.5 h-5 w-5 rounded-full border-2 border-sky-500 bg-white dark:bg-slate-900 flex items-center justify-center text-[10px] font-bold text-sky-600">
                    {event.version_number}
                  </div>

                  {/* Header Box */}
                  <div className="rounded-lg border bg-card p-4 shadow-sm hover:border-sky-300 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {getActionBadge(event.action_type)}
                        <span className="font-semibold text-sm">
                          {event.version_number === 1
                            ? isRtl ? "بنیادی انٹری تخلیق ہوئی" : "Original Entry Created"
                            : isRtl ? `ورژن ${event.version_number} — ترمیم` : `Version ${event.version_number} — Edited`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {dateStr}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {timeStr}
                        </span>
                      </div>
                    </div>

                    {/* Metadata strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground bg-muted/40 p-2 rounded">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-500" />
                        <span>{event.user_name || "System"} ({event.user_role || "Admin"})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        <span>{event.country_name || "Global"} / {event.branch_name || "Main"}</span>
                      </div>
                      {event.reason && (
                        <div className="col-span-2 text-sky-700 dark:text-sky-400">
                          <strong>{isRtl ? "وجہ:" : "Reason:"}</strong> {event.reason}
                        </div>
                      )}
                    </div>

                    {/* Expand/Collapse Button for Diffs */}
                    {event.diff_changes && event.diff_changes.length > 0 && (
                      <div className="mt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(event.version_number)}
                          className="text-xs h-7 gap-1 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" />
                              {isRtl ? "تبدیلیاں چھپائیں" : "Hide Field Changes"}
                            </>
                          ) : (
                            <>
                              <ChevronRight className="h-3.5 w-3.5" />
                              {isRtl
                                ? `+ تبدیل شدہ فیلڈز دیکھیں (${event.diff_changes.length})`
                                : `+ View Changed Fields (${event.diff_changes.length})`}
                            </>
                          )}
                        </Button>

                        {/* Expanded Diff Table */}
                        {isExpanded && (
                          <div className="mt-2 border rounded-md overflow-hidden text-xs">
                            <table className="w-full text-left border-collapse">
                              <thead className="bg-muted text-muted-foreground font-semibold">
                                <tr>
                                  <th className="p-2 border-b">{isRtl ? "فیلڈ" : "Field Name"}</th>
                                  <th className="p-2 border-b text-rose-600">{isRtl ? "پرانی قیمت (Previous)" : "Previous Value"}</th>
                                  <th className="p-2 border-b text-emerald-600">{isRtl ? "نئی قیمت (New)" : "New Value"}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {event.diff_changes.map((diff, dIdx) => (
                                  <tr key={dIdx} className="border-b last:border-0 hover:bg-muted/20">
                                    <td className="p-2 font-mono font-medium">{diff.field}</td>
                                    <td className="p-2 text-rose-700 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 font-mono">
                                      {typeof diff.oldValue === "object"
                                        ? JSON.stringify(diff.oldValue)
                                        : String(diff.oldValue ?? "—")}
                                    </td>
                                    <td className="p-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 font-mono">
                                      {typeof diff.newValue === "object"
                                        ? JSON.stringify(diff.newValue)
                                        : String(diff.newValue ?? "—")}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
