"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useViewMode, viewModeStore } from "@/components/layout/view-mode-store";
import { ViewModeToggle } from "@/components/layout/view-mode-toggle";

/**
 * Mounted ONCE in the dashboard frame. It
 *   1. remembers the chosen view PER REPORT (path + ?type / ?reportType) in localStorage,
 *   2. puts data-view-mode on <main data-erp-content> (the CSS in globals.css turns tables into cards when it is "grid"),
 *   3. labels every cell with its column header (data-label) so a card row reads "Column: value", and
 *   4. tells the toggle whether the page has a table that can be shown as cards.
 * Nothing here touches data: rows, filters, sorting, pagination, totals and actions are exactly the page's own.
 * A table opts out with data-no-cards (editable entry grids, matrices); tables with row/col spans in the body are skipped automatically.
 */
const MIN_COLUMNS = 3;

function eligibleTables(root: ParentNode): HTMLTableElement[] {
  const out: HTMLTableElement[] = [];
  root.querySelectorAll("table").forEach((t) => {
    if (t.hasAttribute("data-no-cards") || t.closest("[data-no-cards]")) return;
    if (t.closest("[data-pdf-flow], .pdf-preview, [role=dialog]")) return;
    const head = t.tHead?.rows[0];
    if (!head || head.cells.length < MIN_COLUMNS) return;
    if (t.tBodies.length === 0 || t.tBodies[0].rows.length === 0) return;
    if (t.querySelector("tbody [rowspan]")) return;
    out.push(t);
  });
  return out;
}

function annotate(table: HTMLTableElement) {
  const head = table.tHead?.rows[0];
  if (!head) return;
  // column index → header text, honouring colspan in the header
  const labels: string[] = [];
  for (const th of Array.from(head.cells)) {
    const text = (th.getAttribute("data-label-text") || th.textContent || "").replace(/\s+/g, " ").trim();
    const span = Math.max(1, Number(th.getAttribute("colspan") || 1));
    for (let i = 0; i < span; i++) labels.push(text);
  }
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      let col = 0;
      for (const cell of Array.from(row.cells)) {
        const span = Math.max(1, Number(cell.getAttribute("colspan") || 1));
        if (span > 1 && span >= labels.length) { cell.setAttribute("data-label", ""); col += span; continue; } // "No data" / group rows
        if (!cell.hasAttribute("data-label")) cell.setAttribute("data-label", labels[col] ?? "");
        col += span;
      }
    }
  }
  table.setAttribute("data-card-ready", "");
}

export function TableCardViewController() {
  const pathname = usePathname();
  const search = useSearchParams();
  const reportKey = search?.get("type") || search?.get("reportType") || "";
  const { eligible } = useViewMode();
  // Pages that draw their own header (no global page bar, no toggle of their own) still get the ONE shared toggle, as a small floating control.
  const [needFloating, setNeedFloating] = useState(false);

  // per-report memory
  useEffect(() => {
    const storageKey = `erp_view_mode:${pathname}${reportKey ? `:${reportKey}` : ""}`;
    viewModeStore.set({ storageKey, mode: viewModeStore.readSaved(storageKey), eligible: false });
  }, [pathname, reportKey]);

  useEffect(() => {
    let raf = 0;
    let timer: number | undefined;
    let floatTimer: number | undefined;
    const run = () => {
      raf = 0;
      const main = document.querySelector<HTMLElement>("main[data-erp-content]");
      if (!main) return;
      const tables = eligibleTables(main);
      viewModeStore.set({ eligible: tables.length > 0 });
      // Decide about the floating toggle only after the page bar had a chance to render ITS toggle for the new eligibility:
      // checking in the same tick showed a second (floating) toggle for a moment on every page that has its own.
      if (floatTimer) window.clearTimeout(floatTimer);
      if (tables.length === 0) setNeedFloating(false);
      else floatTimer = window.setTimeout(() => setNeedFloating(!document.querySelector("[data-testid='view-mode-toggle']:not([data-floating] *)")), 400);
      const mode = viewModeStore.get().mode;
      main.setAttribute("data-view-mode", mode);
      if (mode === "grid") tables.forEach(annotate);
    };
    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (!raf) raf = requestAnimationFrame(run); }, 120);
    };
    run();
    const main = document.querySelector("main[data-erp-content]");
    const mo = new MutationObserver((records) => {
      // ignore our own attribute writes (data-label / data-card-ready / data-view-mode)
      if (records.every((r) => r.type === "attributes" && /^data-(label|card-ready|view-mode)/.test(r.attributeName || ""))) return;
      schedule();
    });
    if (main) mo.observe(main, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "colspan"] });
    // re-apply when the mode changes (the toggle writes to the store)
    let last = viewModeStore.get().mode;
    const unsub = viewModeStore.subscribe(() => { const m = viewModeStore.get().mode; if (m !== last) { last = m; schedule(); } });
    return () => { mo.disconnect(); unsub(); if (timer) window.clearTimeout(timer); if (floatTimer) window.clearTimeout(floatTimer); if (raf) cancelAnimationFrame(raf); };
  }, [pathname, reportKey]);

  if (!eligible || !needFloating) return null;
  return (
    <div className="no-print sticky top-1 z-30 -mb-1 flex h-0 justify-end overflow-visible pe-1">
      <div data-floating className="translate-y-1 rounded-lg bg-background/90 shadow-sm backdrop-blur"><ViewModeToggle /></div>
    </div>
  );
}
