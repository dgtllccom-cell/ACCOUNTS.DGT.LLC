"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Anchor, Check, CheckCircle2, ChevronDown, Clock, FileText, Ship, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

/** Icon for a tracking stage in the status dropdown (same stages the list and the KPI tiles use). */
export function trackingStageIcon(stage: string, className = "h-4 w-4"): ReactNode {
  switch (stage) {
    case "booking": return <FileText className={className} />;
    case "loading": return <Truck className={className} />;
    case "shipment_bl": return <Ship className={className} />;
    case "destination_review": return <Anchor className={className} />;
    case "completed": return <CheckCircle2 className={className} />;
    case "delayed": return <AlertCircle className={className} />;
    default: return <Clock className={className} />;
  }
}

export interface TrackingFilterOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number | string;
}

/**
 * A polished single-choice dropdown for the tracking filters (mode, status, search field).
 * Keyboard: Enter / Space / ArrowDown opens it, Escape closes it. Logical properties keep it RTL-correct.
 */
export function TrackingFilterDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  fallbackIcon,
  ariaLabel,
}: {
  label: string;
  value: T;
  options: TrackingFilterOption<T>[];
  onChange: (value: T) => void;
  fallbackIcon: ReactNode;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex h-12 w-full min-w-0 items-center gap-2.5 rounded-2xl border border-border/70 px-2.5 text-sm font-bold text-foreground",
          "bg-gradient-to-b from-background via-background to-muted/50 transition-all duration-200",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_0_rgba(15,23,42,0.06),0_12px_22px_-14px_rgba(15,23,42,0.45)]",
          "hover:-translate-y-px hover:border-primary/50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_0_rgba(15,23,42,0.05),0_16px_26px_-14px_rgba(37,99,235,0.45)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:text-blue-300">
          {current.icon ?? fallbackIcon}
        </span>
        <span className="min-w-0 flex-1 truncate text-start">{current.label}</span>
        {current.count !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-muted-foreground" dir="ltr">
            {current.count}
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute start-0 z-50 mt-2 max-h-80 w-full min-w-[14rem] overflow-y-auto rounded-2xl border border-border/70 bg-popover/95 p-1.5 shadow-[0_28px_60px_-20px_rgba(15,23,42,0.5)] backdrop-blur-xl"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-sm font-semibold transition-colors",
                    active ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "text-foreground hover:bg-muted/70"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
                      active ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {o.icon ?? fallbackIcon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-start">{o.label}</span>
                  {o.count !== undefined && (
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground" dir="ltr">
                      {o.count}
                    </span>
                  )}
                  {active && <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
