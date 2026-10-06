"use client";

import { Paperclip, Download, FileText, FileDown, Eye, Printer } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * ERP file / document action-icon standard
 * ───────────────────────────────────────
 * One clean paperclip/file-style visual family for every file-related action,
 * so Files, Attachments, Documents, Download and PDF read as one system — while
 * each action stays visually and semantically distinct (Download ≠ Attachment ≠
 * View ≠ Print).
 *
 *   <DownloadActionIcon />    genuine "save this file to my device" / export
 *   <AttachmentActionIcon />  an attached / linked file (📎, matches the reference)
 *   <DocumentActionIcon />    a document / record
 *   <PdfActionIcon />         a PDF specifically (file-with-down-arrow, red accent)
 *   <ViewActionIcon />        open / preview on screen (never a download)
 *   <PrintActionIcon />       send to printer (never a download)
 *
 * Pair every icon with a real label/tooltip that names the actual action.
 */

type IconProps = Omit<ComponentProps<typeof Paperclip>, "ref">;

/** Download / export a file to the user's device. */
export function DownloadActionIcon({ className, ...props }: IconProps) {
  return (
    <Download
      className={cn("h-4 w-4 text-slate-700 dark:text-slate-200", className)}
      aria-hidden
      strokeWidth={2.25}
      {...props}
    />
  );
}

/** An attached / linked file — the paperclip from the reference design. */
export function AttachmentActionIcon({ className, ...props }: IconProps) {
  return (
    <Paperclip
      className={cn("h-4 w-4 text-slate-700 dark:text-slate-200", className)}
      aria-hidden
      strokeWidth={2.25}
      {...props}
    />
  );
}

/** A document / record (not necessarily downloadable). */
export function DocumentActionIcon({ className, ...props }: IconProps) {
  return (
    <FileText
      className={cn("h-4 w-4 text-slate-700 dark:text-slate-200", className)}
      aria-hidden
      strokeWidth={2.25}
      {...props}
    />
  );
}

/** A PDF file / "Export PDF". */
export function PdfActionIcon({ className, ...props }: IconProps) {
  return (
    <FileDown
      className={cn("h-4 w-4 text-rose-600 dark:text-rose-400", className)}
      aria-hidden
      strokeWidth={2.25}
      {...props}
    />
  );
}

/** Open / preview on screen — explicitly NOT a download. */
export function ViewActionIcon({ className, ...props }: IconProps) {
  return (
    <Eye
      className={cn("h-4 w-4 text-slate-700 dark:text-slate-200", className)}
      aria-hidden
      strokeWidth={2.25}
      {...props}
    />
  );
}

/** Send to printer — explicitly NOT a download. */
export function PrintActionIcon({ className, ...props }: IconProps) {
  return (
    <Printer
      className={cn("h-4 w-4 text-slate-700 dark:text-slate-200", className)}
      aria-hidden
      strokeWidth={2.25}
      {...props}
    />
  );
}
