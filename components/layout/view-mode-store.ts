"use client";

import { useSyncExternalStore } from "react";

/**
 * Grid / List view for every report and record-list page — ONE shared mechanism.
 *
 *  • "list" = the page's own table, full-width rows, all columns (the default, unchanged).
 *  • "grid" = the SAME table rendered as responsive cards (pure presentation: same rows, filters, sorting, pagination, totals, actions).
 *
 * The TableCardViewController (mounted once in the dashboard frame) applies the mode and reports whether the current page has a table that
 * can be shown as cards (`eligible`); <ViewModeToggle /> reads this store, so there is exactly one toggle implementation.
 */
export type ViewMode = "list" | "grid";
type State = { mode: ViewMode; eligible: boolean; storageKey: string };

let state: State = { mode: "list", eligible: false, storageKey: "" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const viewModeStore = {
  get: () => state,
  subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
  set(patch: Partial<State>) {
    const next = { ...state, ...patch };
    if (next.mode === state.mode && next.eligible === state.eligible && next.storageKey === state.storageKey) return;
    state = next;
    emit();
  },
  setMode(mode: ViewMode) {
    if (state.storageKey) { try { window.localStorage.setItem(state.storageKey, mode); } catch { /* private mode: still works for this visit */ } }
    viewModeStore.set({ mode });
  },
  readSaved(storageKey: string): ViewMode {
    try { return window.localStorage.getItem(storageKey) === "grid" ? "grid" : "list"; } catch { return "list"; }
  }
};

const SERVER: State = { mode: "list", eligible: false, storageKey: "" };
export function useViewMode() {
  const s = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
    () => SERVER
  );
  return { mode: s.mode, eligible: s.eligible, setMode: viewModeStore.setMode };
}
