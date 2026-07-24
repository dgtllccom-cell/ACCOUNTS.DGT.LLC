"use client";

import type { ReactNode } from "react";
import { ViewportActionMenu } from "@/components/ui/viewport-action-menu";
import {
  MoreVertical,
  Eye,
  Edit3,
  Printer,
  Download,
  FileSpreadsheet,
  Mail,
  MessageSquare,
  FileText,
  Trash2,
  ExternalLink
} from "lucide-react";

export type UnifiedActionItem = {
  key?: string;
  label: string;
  icon?: ReactNode;
  variant?: "default" | "destructive" | "primary" | "success";
  disabled?: boolean;
  onClick: () => void;
};

export type UnifiedActionMenuProps = {
  ariaLabel?: string;
  align?: "left" | "right";
  buttonClassName?: string;
  menuClassName?: string;
  // Standardized Action Handler Callbacks
  onView?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  onEmail?: () => void;
  onWhatsApp?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  // Additional module-specific custom action items
  customItems?: UnifiedActionItem[];
};

/**
 * Unified Single Three-Dot (⋮) Action Menu Component
 *
 * Standardized reusable action menu component used across all ERP modules
 * (forms, reports, registers, journals, ledgers, purchases, sales, loading, payments).
 * Ensures exactly ONE action menu per record with standard actions:
 * View, Edit, Print, PDF Export, Excel Export, Email, WhatsApp, Download, and custom items.
 */
export function UnifiedActionMenu({
  ariaLabel = "Record actions",
  align = "right",
  buttonClassName,
  menuClassName,
  onView,
  onEdit,
  onPrint,
  onExportPdf,
  onExportExcel,
  onEmail,
  onWhatsApp,
  onDownload,
  onDelete,
  customItems = []
}: UnifiedActionMenuProps) {
  return (
    <ViewportActionMenu
      ariaLabel={ariaLabel}
      align={align}
      buttonClassName={
        buttonClassName ||
        "grid h-8 w-8 place-items-center rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors shadow-sm"
      }
      trigger={<MoreVertical className="h-4 w-4" aria-hidden />}
      menuClassName={menuClassName || "w-56 p-1 bg-popover border border-border shadow-xl rounded-xl"}
    >
      {(close) => {
        const handleAction = (cb?: () => void) => {
          close();
          if (cb) cb();
        };

        return (
          <div className="py-1 space-y-0.5">
            {onView && (
              <button
                type="button"
                onClick={() => handleAction(onView)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <Eye className="h-4 w-4 text-blue-500 shrink-0" />
                <span>View</span>
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => handleAction(onEdit)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <Edit3 className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Edit</span>
              </button>
            )}

            {onPrint && (
              <button
                type="button"
                onClick={() => handleAction(onPrint)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <Printer className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Print</span>
              </button>
            )}

            {onExportPdf && (
              <button
                type="button"
                onClick={() => handleAction(onExportPdf)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                <span>PDF Export</span>
              </button>
            )}

            {onExportExcel && (
              <button
                type="button"
                onClick={() => handleAction(onExportExcel)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Excel Export</span>
              </button>
            )}

            {onEmail && (
              <button
                type="button"
                onClick={() => handleAction(onEmail)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <Mail className="h-4 w-4 text-indigo-500 shrink-0" />
                <span>Email Document</span>
              </button>
            )}

            {onWhatsApp && (
              <button
                type="button"
                onClick={() => handleAction(onWhatsApp)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <MessageSquare className="h-4 w-4 text-green-500 shrink-0" />
                <span>WhatsApp Document</span>
              </button>
            )}

            {onDownload && (
              <button
                type="button"
                onClick={() => handleAction(onDownload)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
              >
                <Download className="h-4 w-4 text-cyan-500 shrink-0" />
                <span>Download</span>
              </button>
            )}

            {customItems.map((item, idx) => (
              <button
                key={item.key || idx}
                type="button"
                disabled={item.disabled}
                onClick={() => handleAction(item.onClick)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  item.disabled
                    ? "opacity-50 cursor-not-allowed text-muted-foreground"
                    : item.variant === "destructive"
                    ? "text-destructive hover:bg-destructive/10"
                    : item.variant === "primary"
                    ? "text-primary hover:bg-primary/10"
                    : "text-foreground hover:bg-accent"
                }`}
              >
                <span className="shrink-0">{item.icon || <ExternalLink className="h-4 w-4" />}</span>
                <span>{item.label}</span>
              </button>
            ))}

            {onDelete && (
              <>
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={() => handleAction(onDelete)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        );
      }}
    </ViewportActionMenu>
  );
}
