"use client";

import { useEffect, useRef, useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReportFilterMenu({
  ariaLabel,
  disabled,
  children,
  onOpenChange
}: {
  ariaLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  function setOpenSafe(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenSafe(false);
    }

    function onMouseDown(e: MouseEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return;
      setOpenSafe(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpenSafe(!open)}
      >
        <Filter className="h-4 w-4" aria-hidden />
      </Button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 top-full z-20 mt-2 w-[min(92vw,640px)] overflow-hidden rounded-lg border bg-background shadow-lg"
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

