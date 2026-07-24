"use client";

import { useState, useEffect } from "react";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentManagerModal } from "./document-manager-modal";

interface DocumentAttachmentIconProps {
  entityType: string;
  entityId: string;
  className?: string;
  initialCount?: number;
}

export function DocumentAttachmentIcon({
  entityType,
  entityId,
  className,
  initialCount
}: DocumentAttachmentIconProps) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(initialCount ?? null);

  // If initialCount is not provided, fetch it (lazy load)
  useEffect(() => {
    if (initialCount === undefined && entityId) {
      fetch(`/api/erp/documents?entityType=${entityType}&entityId=${entityId}`)
        .then(res => res.json())
        .then(data => {
          if (data?.data?.results) {
            setCount(data.data.results.length);
          }
        })
        .catch(() => setCount(0));
    }
  }, [entityType, entityId, initialCount]);

  const displayCount = count ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
          displayCount > 0
            ? "bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
            : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
          className
        )}
        title="Manage Attachments"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {displayCount > 0 && <span>{displayCount}</span>}
      </button>

      {/* Only render modal when open to save DOM nodes */}
      {open && (
        <DocumentManagerModal
          open={open}
          onOpenChange={setOpen}
          entityType={entityType}
          entityId={entityId}
          onCountChange={setCount}
        />
      )}
    </>
  );
}
