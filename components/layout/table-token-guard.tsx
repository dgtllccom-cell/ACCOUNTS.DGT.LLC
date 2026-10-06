"use client";

import { useEffect } from "react";

/**
 * TableTokenGuard — on phones and tablets a narrow table cell used to split a code, date or one-word name across lines
 * ("LP-CTY-" / "00000491", "22/09/" / "2026", "Pakis-" / "tan"). This marks every table cell whose text is ONE token
 * (no spaces) with `data-token`; app/design-system.css keeps such cells on a single line (the table then scrolls inside its own
 * container instead). Presentation only: it reads cell text, never changes it. Idle, throttled, and only active below the desktop
 * breakpoint, so desktop computers pay nothing.
 */
const TOUCH = "(max-width: 1023.98px), (pointer: coarse) and (max-width: 1399.98px)";

function mark(cell: Element) {
  const t = (cell.textContent || "").trim();
  const single = t.length > 0 && t.length <= 48 && !/\s/.test(t);
  if (single) { if (!cell.hasAttribute("data-token")) cell.setAttribute("data-token", ""); }
  else if (cell.hasAttribute("data-token")) cell.removeAttribute("data-token");
}

function scan(root: ParentNode) {
  root.querySelectorAll("td, th").forEach(mark);
}

export function TableTokenGuard() {
  useEffect(() => {
    const mq = window.matchMedia(TOUCH);
    let observer: MutationObserver | null = null;
    let timer: number | null = null;
    const pending = new Set<Node>();
    const flush = () => {
      timer = null;
      for (const n of pending) {
        const el = n.nodeType === 1 ? (n as Element) : n.parentElement;
        if (!el || !el.isConnected) continue;
        const cell = el.closest("td, th");
        if (cell) mark(cell);
        if (el.querySelector) scan(el);
      }
      pending.clear();
    };
    const queue = (n: Node) => {
      pending.add(n);
      if (timer == null) timer = window.setTimeout(flush, 200);
    };
    const start = () => {
      if (observer || !mq.matches) return;
      scan(document);
      observer = new MutationObserver((records) => {
        for (const r of records) {
          if (r.type === "characterData") queue(r.target);
          else r.addedNodes.forEach((n) => queue(n));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    const stop = () => {
      if (observer) { observer.disconnect(); observer = null; }
      document.querySelectorAll("[data-token]").forEach((c) => c.removeAttribute("data-token"));
    };
    const onChange = () => (mq.matches ? start() : stop());
    start();
    mq.addEventListener("change", onChange);
    return () => { mq.removeEventListener("change", onChange); stop(); if (timer != null) window.clearTimeout(timer); };
  }, []);
  return null;
}
