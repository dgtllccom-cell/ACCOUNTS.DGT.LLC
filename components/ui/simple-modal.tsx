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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 overflow-y-auto print:static print:bg-transparent print:p-0 print:block backdrop-blur-xs">
      <div
        className={cn(
          "relative w-full max-w-2xl rounded-2xl border bg-card shadow-2xl my-auto flex flex-col print:max-w-none print:border-none print:shadow-none",
          // max-height: leave gap from viewport edges
          "max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)]",
          className
        )}
      >
        {/* Sticky Title Bar */}
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4 bg-card rounded-t-2xl print:hidden">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate pr-4">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition"
            aria-label="Close"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
          </button>
        </div>
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-4 p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
