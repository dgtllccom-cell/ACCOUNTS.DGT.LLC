"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function DetailDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  actions,
  className
}: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div
        ref={drawerRef}
        className={cn(
          "relative z-10 flex h-full w-full flex-col bg-background shadow-2xl border-s border-border animate-in slide-in-from-right duration-300 ease-out sm:max-w-xl md:max-w-2xl ltr:left-auto rtl:right-auto",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 bg-slate-50/50 dark:bg-slate-900/10">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {actions && <div className="flex items-center gap-2">{actions}</div>}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-transparent hover:border-border"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-card">
          {children}
        </div>
      </div>
    </div>
  );
}
