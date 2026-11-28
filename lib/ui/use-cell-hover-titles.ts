"use client";

import { useEffect, useRef, type RefObject } from "react";

/** The full text of a cell is kept here; the hover bubble reads it. */
export const HOVER_TEXT_ATTR = "data-hover-text";
const BUBBLE_ID = "erp-cell-hover-bubble";

/**
 * The full visible text of a table cell, one line per visual line: badges, codes, sub-lines and
 * "By: …" footers each on their own line. Uses innerText in the browser; falls back to textContent.
 */
/** Hidden popovers, icons-only overlays and screen-reader-hidden parts never belong in the bubble. */
const HIDDEN_PARTS = '[hidden], [aria-hidden="true"], [role="tooltip"], .hidden, .invisible, .opacity-0, .sr-only, [data-no-hover-title]';

export function cellHoverText(cell: HTMLElement): string {
  let source: HTMLElement = cell;
  if (cell.querySelector(HIDDEN_PARTS)) {
    source = cell.cloneNode(true) as HTMLElement;
    source.querySelectorAll(HIDDEN_PARTS).forEach((node) => node.remove());
  }
  // innerText only exists for elements in the document; the clone falls back to textContent
  const raw = source === cell && typeof cell.innerText === "string" && cell.innerText.length > 0 ? cell.innerText : source.textContent || "";
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  // "By:" / "Category:" labels stay on the same line as their value
  const joined: string[] = [];
  for (const line of lines) {
    const last = joined[joined.length - 1];
    if (last && last.endsWith(":")) joined[joined.length - 1] = `${last} ${line}`;
    else joined.push(line);
  }
  return joined.join("\n");
}

/** Store every data cell's (tbody td) full text; icon-only / empty cells and opted-out cells get none. */
export function applyCellHoverTitles(container: HTMLElement) {
  container.querySelectorAll<HTMLTableCellElement>("tbody td").forEach((cell) => {
    const text = cell.hasAttribute("data-no-hover-title") ? "" : cellHoverText(cell);
    if (!text) {
      cell.removeAttribute(HOVER_TEXT_ATTR);
      return;
    }
    if (cell.getAttribute(HOVER_TEXT_ATTR) !== text) cell.setAttribute(HOVER_TEXT_ATTR, text);
  });
}

function bubble(): HTMLDivElement {
  let el = document.getElementById(BUBBLE_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = BUBBLE_ID;
    el.setAttribute("role", "tooltip");
    el.setAttribute("dir", "auto");
    el.className =
      "pointer-events-none fixed z-[1000] max-w-[360px] whitespace-pre-line break-words rounded-lg border border-slate-700 " +
      "bg-slate-900/95 px-3 py-2 text-[12px] font-medium leading-snug text-white shadow-xl";
    el.style.display = "none";
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Show the message bubble with `text` next to `anchor`: "below" (table cells; above when there is no
 * room) or "side" (dropdown options; on the end side, flipping when there is no room). Kept on screen.
 */
export function showHoverBubble(anchor: HTMLElement, text: string, placement: "below" | "side" = "below") {
  if (!text) return;
  const el = bubble();
  el.textContent = text;
  el.style.display = "block";
  const r = anchor.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const rtl = getComputedStyle(anchor).direction === "rtl";
  let left: number;
  let top: number;
  if (placement === "side") {
    const after = rtl ? r.left - b.width - 8 : r.right + 8;
    const before = rtl ? r.right + 8 : r.left - b.width - 8;
    left = after >= 8 && after + b.width <= vw - 8 ? after : before;
    top = r.top;
  } else {
    left = rtl ? r.right - b.width : r.left;
    top = r.bottom + 6;
    if (top + b.height > vh - 8) top = r.top - b.height - 6;
  }
  left = Math.max(8, Math.min(left, vw - b.width - 8));
  top = Math.max(8, Math.min(top, vh - b.height - 8));
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

/** Show the bubble for a table cell, using the full text stored on it. */
export function showCellBubble(cell: HTMLElement) {
  const text = cell.getAttribute(HOVER_TEXT_ATTR);
  if (text) showHoverBubble(cell, text, "below");
}

export function hideCellBubble() {
  const el = document.getElementById(BUBBLE_ID);
  if (el) el.style.display = "none";
}

/**
 * Hover any row cell of the referenced table to see that cell's complete data in a message bubble
 * (account number, full name, category, country, branch + created by, currency, status …), also when
 * the column truncates it. Re-reads the cells whenever the table re-renders (filters, paging, language).
 */
export function useCellHoverTitles(ref: RefObject<HTMLElement | null>) {
  const attached = useRef<{ el: HTMLElement; stop: () => void } | null>(null);
  // Runs after every render: attaches once the table exists (it may mount after a loading state)
  // and moves to a new table element if React replaces it.
  useEffect(() => {
    const container = ref.current;
    if (attached.current?.el === container) return;
    attached.current?.stop();
    attached.current = null;
    if (!container) return;

    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        observer.disconnect();
        applyCellHoverTitles(container);
        observer.observe(container, { childList: true, subtree: true, characterData: true });
      });
    });
    let current: HTMLElement | null = null;
    const over = (event: Event) => {
      const cell = (event.target as HTMLElement | null)?.closest?.(`td[${HOVER_TEXT_ATTR}]`) as HTMLElement | null;
      if (cell === current) return;
      current = cell && container.contains(cell) ? cell : null;
      if (current) showCellBubble(current);
      else hideCellBubble();
    };
    const out = (event: MouseEvent) => {
      const to = event.relatedTarget as Node | null;
      if (to && container.contains(to)) return;
      current = null;
      hideCellBubble();
    };
    const hide = () => {
      current = null;
      hideCellBubble();
    };

    applyCellHoverTitles(container);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    container.addEventListener("mouseover", over);
    container.addEventListener("mouseout", out);
    window.addEventListener("scroll", hide, true);

    attached.current = {
      el: container,
      stop: () => {
        observer.disconnect();
        if (frame) cancelAnimationFrame(frame);
        container.removeEventListener("mouseover", over);
        container.removeEventListener("mouseout", out);
        window.removeEventListener("scroll", hide, true);
        hideCellBubble();
      }
    };
  });
  useEffect(() => () => {
    attached.current?.stop();
    attached.current = null;
  }, []);
}
