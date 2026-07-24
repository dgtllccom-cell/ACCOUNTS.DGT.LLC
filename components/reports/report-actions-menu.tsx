"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, MoreVertical, Printer } from "lucide-react";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReportActionsMenuProps = {
  disabled?: boolean;
  onPrint: () => void;
  onPdf: () => void;
  onExcel: () => void;
  ariaLabel?: string;
};

export function ReportActionsMenu({ disabled, onPrint, onPdf, onExcel, ariaLabel = "Report actions" }: ReportActionsMenuProps) {
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

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={rootRef} className="relative">
      <Button type="button" variant="outline" size="icon" aria-label={ariaLabel} disabled={disabled} onClick={() => setOpen((current) => !current)}>
        <MoreVertical className="h-4 w-4" aria-hidden />
      </Button>

      {open ? (
        <div className={cn("absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-lg border bg-background shadow-lg")}>
          <button type="button" onClick={() => run(onPrint)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </button>
          <button type="button" onClick={() => run(onPdf)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
            <DownloadActionIcon className="h-4 w-4" aria-hidden />
            PDF Export
          </button>
          <button type="button" onClick={() => run(onExcel)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Excel Export
          </button>
        </div>
      ) : null}
    </div>
  );
}
