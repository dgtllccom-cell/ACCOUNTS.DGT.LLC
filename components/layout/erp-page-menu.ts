"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

/**
 * ONE ⋮ menu per page. The global ErpPageActions bar owns the only Back button and the only ⋮ menu; a page that has its own actions
 * (report kinds, exports, record actions…) registers them here instead of drawing a second ⋮ — so the user never sees two menus.
 *
 *   useErpPageMenu([{ key: "excel", label: t("Excel"), icon: <Sheet/>, onSelect: exportExcel, hidden: !perms.export }],
 *                  { hideDefaults: ["print", "pdf", "edit"] });
 *
 * Items are re-registered whenever the page re-renders them; they are removed when the page unmounts. Permissions are the page's job:
 * pass `hidden: true` for anything the user may not do (the menu never shows it and the page's own API still enforces it).
 */
export type ErpPageMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  hidden?: boolean;
  /** draw a divider above this item */
  separatorBefore?: boolean;
};

export type ErpDefaultAction = "print" | "pdf" | "email" | "whatsapp" | "connect" | "edit" | "refresh" | "copy";

type MenuState = { items: ErpPageMenuItem[]; hideDefaults: ReadonlySet<ErpDefaultAction> };
const EMPTY: MenuState = { items: [], hideDefaults: new Set() };

let state: MenuState = EMPTY;
let owner: symbol | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useErpPageMenuState(): MenuState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
    () => EMPTY
  );
}

export function useErpPageMenu(items: ErpPageMenuItem[], opts: { hideDefaults?: ErpDefaultAction[] } = {}) {
  const id = useRef(Symbol("erp-page-menu"));
  const hide = (opts.hideDefaults ?? []).join(",");
  // Registration is keyed by the item identity list so a render with the same keys/labels doesn't thrash subscribers; the onSelect closures
  // are read through a ref so they are never stale.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const signature = items.map((i) => `${i.key}|${i.label}|${i.hidden ? 1 : 0}|${i.disabled ? 1 : 0}`).join(";");

  useEffect(() => {
    owner = id.current;
    state = {
      items: itemsRef.current.map((it, idx) => ({ ...it, onSelect: () => itemsRef.current[idx]?.onSelect?.() })),
      hideDefaults: new Set(hide ? (hide.split(",") as ErpDefaultAction[]) : [])
    };
    emit();
    return () => {
      if (owner === id.current) { owner = null; state = EMPTY; emit(); }
    };
  }, [signature, hide]);
}
