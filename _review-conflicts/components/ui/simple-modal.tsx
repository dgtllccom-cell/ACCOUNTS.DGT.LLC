"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SimpleModal({
  title,
  children,
  onClose,
  className
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-2 sm:p-4 overflow-y-auto print:static print:bg-transparent print:p-0 print:block">
      <div
        className={cn(
          "relative w-full max-w-2xl rounded-lg border bg-card shadow-2xl my-2 sm:my-4 flex flex-col print:max-w-none print:border-none print:shadow-none",
          // max-height: leave at least 16px gap from viewport edges
          "max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]",
          className
        )}
      >
        {/* Sticky Title Bar */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4 bg-card rounded-t-lg print:hidden">
          <h2 className="text-sm font-semibold truncate pr-4">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-4 p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
