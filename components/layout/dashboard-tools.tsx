"use client";

import React, { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

/** One set of tools: inline on desktop, an overflow panel on phones. */
export function DashboardTools({ children }: { children: ReactNode }) {
  const lang = useActiveLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={root} className="erp-topbar-tools" data-open={open}>
      <button ref={trigger} type="button" className="erp-tools-trigger" aria-label={t(lang, "common.actions", "Actions")} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      <div id={panelId} className="erp-topbar-tools-content">{children}</div>
    </div>
  );
}
