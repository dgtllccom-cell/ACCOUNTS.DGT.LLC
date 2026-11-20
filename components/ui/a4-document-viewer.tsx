"use client";

/**
 * One way to "View" a record anywhere in the ERP: a full-screen overlay (nothing of the screen behind stays readable)
 * with the record laid out as one A4 page in the centre and a sticky toolbar (title, actions, Close) on top.
 *
 * - `fit="page"`: the content is a fixed 794px (A4) document — invoices, vouchers, print previews. On a phone the whole
 *   page is scaled down to the screen width, like a PDF viewer, so nothing is cut off.
 * - `fit="fluid"` (default): the content is an ordinary responsive detail panel; it gets the A4 width on large screens
 *   and the full width on phones.
 * - `wide`: for detail views that are wider than A4 (multi-column reports); the page grows up to 1280px.
 *
 * Esc, the Close button and a tap outside the page close it; page scroll is locked while open.
 * It is a role="dialog" marked data-a4-viewer, which the global mobile/dialog size rules (app/design-system.css,
 * app/globals.css) leave alone: this overlay sizes itself.
 */

import React, { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export const A4_PAGE_WIDTH_PX = 794;
const RTL_LANGS = new Set(["ur", "ar", "fa", "ps"]);

export function a4FitZoom(viewportWidth: number, gutter = 16): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 1;
  return Math.min(1, Math.max(0.3, (viewportWidth - gutter) / A4_PAGE_WIDTH_PX));
}

export interface A4DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  fit?: "page" | "fluid";
  wide?: boolean;
  /** extra classes for the white page */
  pageClassName?: string;
  /** extra classes for the content area inside the page */
  bodyClassName?: string;
  testId?: string;
}

export function A4DocumentViewer({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  actions,
  children,
  fit = "fluid",
  wide = false,
  pageClassName,
  bodyClassName,
  testId = "a4-document-viewer",
}: A4DocumentViewerProps) {
  const lang = useActiveLanguage();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const fitPage = () => setZoom(a4FitZoom(window.innerWidth));
    fitPage();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", fitPage);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fitPage);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pageWidth = wide ? "max-w-[1280px]" : "max-w-[calc(794px+3rem)]";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
      data-a4-viewer=""
      data-testid={testId}
      dir={RTL_LANGS.has(String(lang)) ? "rtl" : "ltr"}
      className="fixed inset-0 !m-0 z-[200] overflow-y-auto bg-slate-950/85 backdrop-blur-sm animate-in fade-in print:static print:bg-white print:backdrop-blur-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "relative mx-auto w-full min-h-full sm:min-h-[297mm] sm:my-6 bg-white text-slate-900 shadow-2xl sm:rounded-md dark:bg-slate-900 dark:text-slate-100",
          pageWidth,
          pageClassName
        )}
      >
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur sm:rounded-t-md sm:px-6 dark:border-slate-800 dark:bg-slate-900/95 print:hidden">
          <div className="min-w-0 space-y-0.5">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase text-slate-800 dark:text-slate-100">
              {icon}
              <span className="truncate">{title}</span>
            </h2>
            {subtitle ? <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              aria-label={t(lang, "dd.close_panel", "Close panel")}
            >
              <X className="h-3.5 w-3.5" /> {t(lang, "common.close", "Close")}
            </button>
          </div>
        </div>

        {fit === "page" ? (
          <div className="overflow-x-hidden">
            <div className={cn("mx-auto py-2 sm:p-6", bodyClassName)} style={{ width: A4_PAGE_WIDTH_PX, zoom }}>
              {children}
            </div>
          </div>
        ) : (
          <div className={cn("px-3 py-4 sm:px-6 sm:py-6", bodyClassName)}>{children}</div>
        )}
      </div>
    </div>
  );
}
