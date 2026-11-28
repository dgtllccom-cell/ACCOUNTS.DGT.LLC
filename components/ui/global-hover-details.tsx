"use client";

import { useEffect } from "react";
import { cellHoverText, hideCellBubble, isEditableCell, showHoverBubble } from "@/lib/ui/use-cell-hover-titles";

/** Areas that already run their own hover bubble (useCellHoverTitles / HoverCellsArea / SearchSelect optionHoverDetails). */
export const HOVER_OWNED_ATTR = "data-hover-owned";

const TRUNCATING = '.truncate, [class*="line-clamp"], [class*="text-ellipsis"]';

function isOverflowing(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}

/**
 * What to show for the element under the mouse, anywhere in the ERP:
 *  1. a table row cell (tbody td): the cell's complete data (names, links, codes, amounts, "By: …");
 *  2. a line of a summary card ("BRANCH NAME:  Dubai City Branch"): the full label and value;
 *  3. otherwise a name / link / label cut off with an ellipsis (truncate / line-clamp): its full text.
 * Never for cells or elements that opt out, already carry a native title, or belong to an area with its own bubble.
 */
export function hoverDetailsTarget(start: EventTarget | null): { anchor: HTMLElement; text: string } | null {
  const el = start instanceof HTMLElement ? start : (start as Node | null)?.parentElement ?? null;
  if (!el || el.closest(`[${HOVER_OWNED_ATTR}], [data-no-hover-title], [role="tooltip"]`)) return null;

  const cell = el.closest("tbody td") as HTMLElement | null;
  if (cell) {
    if (cell.hasAttribute("title") || isEditableCell(cell)) return null; // keep a native tooltip; editable cells show their own value
    const text = cellHoverText(cell);
    return text ? { anchor: cell, text } : null;
  }

  const row = summaryCardRow(el);
  if (row) {
    const text = cardRowText(row);
    if (text) return { anchor: row, text };
  }

  const cut = el.closest(TRUNCATING) as HTMLElement | null;
  if (cut && !cut.hasAttribute("title") && isOverflowing(cut)) {
    const text = cellHoverText(cut);
    return text ? { anchor: cut, text } : null;
  }
  return null;
}

const LABEL_END = /[:：؛]\s*$/;

/** "Label: value" from a card line's parts (label, value, optional chip / unit), each part's text on one line. */
export function cardRowText(row: HTMLElement): string {
  const parts = Array.from(row.children)
    .map((child) => cellHoverText(child as HTMLElement).replace(/\n+/g, " ").trim())
    .filter(Boolean);
  if (parts.length < 2) return parts.join("");
  const label = LABEL_END.test(parts[0]) ? parts[0] : `${parts[0]}:`;
  return `${label} ${parts.slice(1).join(" ")}`;
}
const NOT_A_CARD_ROW = 'a, button, nav, header, footer, form, [role="menu"], [role="listbox"], [role="dialog"] [role="option"], thead';

/**
 * A line of a summary card at the top of an ERP page ("BRANCH NAME:  Dubai City Branch", "Total Debit:  2,000.00"):
 * a small row whose first part is a label ending with ":" — or a <dt>/<dd> pair. Rows holding form fields are not cards.
 */
export function summaryCardRow(el: HTMLElement): HTMLElement | null {
  const pair = el.closest("dt, dd") as HTMLElement | null;
  if (pair?.parentElement && !pair.parentElement.matches("dl")) return pair.parentElement;
  let node: HTMLElement | null = el;
  for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
    const kids = node.children;
    if (kids.length >= 2 && kids.length <= 4) {
      const label = (kids[0].textContent || "").trim();
      if (label && label.length <= 60 && LABEL_END.test(label)) {
        if (node.closest(NOT_A_CARD_ROW) || isEditableCell(node)) return null;
        if ((node.textContent || "").length > 400) return null;
        return node;
      }
    }
  }
  return null;
}

/**
 * Mounted once in the root layout: every table and every cut-off name or link in the whole ERP shows its full data in a
 * message bubble on hover. The text is read lazily from what is rendered at that moment, so it always follows the active
 * language (EN / UR / AR / FA / PS) and the bubble aligns to the reading direction.
 */
export function GlobalHoverDetails() {
  useEffect(() => {
    let current: HTMLElement | null = null;
    const over = (event: MouseEvent) => {
      const hit = hoverDetailsTarget(event.target);
      if (hit?.anchor === current) return;
      if (!hit) {
        if (current) {
          current = null;
          hideCellBubble();
        }
        return;
      }
      current = hit.anchor;
      showHoverBubble(hit.anchor, hit.text, "below");
    };
    const out = (event: MouseEvent) => {
      if (!current) return;
      const to = event.relatedTarget as Node | null;
      if (to && current.contains(to)) return;
      current = null;
      hideCellBubble();
    };
    const hide = () => {
      if (!current) return;
      current = null;
      hideCellBubble();
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("mouseout", out);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mouseout", out);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);
  return null;
}
