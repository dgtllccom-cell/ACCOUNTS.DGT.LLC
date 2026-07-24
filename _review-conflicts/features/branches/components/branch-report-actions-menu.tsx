"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, FileSpreadsheet, Mail, MoreVertical, PencilLine, Printer } from "lucide-react";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BranchReportActionsMenuProps = {
  disabled?: boolean;
  onView: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onPdf: () => void;
  onEmail: () => void;
  onExcel: () => void;
  ariaLabel?: string;
};

export function BranchReportActionsMenu({
  disabled,
  onView,
  onEdit,
  onPrint,
  onPdf,
  onEmail,
  onExcel,
  ariaLabel = "Branch report actions"
}: BranchReportActionsMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onMouseDown(event: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  function closeAndRun(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={rootRef} className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={onView}
        className="flex h-10 items-center gap-1.5 rounded-lg border-slate-200 px-3 text-sm font-semibold hover:bg-muted dark:hover:bg-slate-800"
      >
        <Eye className="h-4 w-4" aria-hidden />
        View
      </Button>

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
        </Button>

        {open ? (
          <div
            className={cn(
              "absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-lg border bg-background shadow-lg"
            )}
          >
            <button
              type="button"
              onClick={() => closeAndRun(onView)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <Eye className="h-4 w-4" aria-hidden />
              View
            </button>
            <button
              type="button"
              onClick={() => closeAndRun(onEdit)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <PencilLine className="h-4 w-4" aria-hidden />
              Edit
            </button>
            <button
              type="button"
              onClick={() => closeAndRun(onPrint)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </button>
            <button
              type="button"
              onClick={() => closeAndRun(onPdf)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <DownloadActionIcon className="h-4 w-4" aria-hidden />
              PDF Download
            </button>
            <button
              type="button"
              onClick={() => closeAndRun(onEmail)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Email
            </button>
            <button
              type="button"
              onClick={() => closeAndRun(onExcel)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              Excel
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
