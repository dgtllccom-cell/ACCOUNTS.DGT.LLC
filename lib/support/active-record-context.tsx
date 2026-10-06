"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/**
 * The record the user is currently viewing/editing, as reported by whichever
 * feature page is mounted right now. Used to scope Safe Support Assistant's
 * Allow-Once consent to "this one record" instead of "this browser session" —
 * per the approved spec, consent must be specific to one record and must
 * revoke when the record changes.
 *
 * A page that isn't about a specific record (a list, a dashboard) simply
 * never calls setActiveRecord, leaving it null — Support then only offers
 * page-level guidance, not record access, which is the correct behavior.
 */
export type ActiveRecord = {
  table: string;
  id: string;
  label?: string | null;
};

type ActiveRecordContextValue = {
  activeRecord: ActiveRecord | null;
  setActiveRecord: (record: ActiveRecord | null) => void;
};

const ActiveRecordContext = createContext<ActiveRecordContextValue | null>(null);

export function ActiveRecordProvider({ children }: { children: React.ReactNode }) {
  const [activeRecord, setActiveRecordState] = useState<ActiveRecord | null>(null);

  const setActiveRecord = useCallback((record: ActiveRecord | null) => {
    setActiveRecordState((prev) => {
      if (prev?.table === record?.table && prev?.id === record?.id) return prev;
      return record;
    });
  }, []);

  const value = useMemo(() => ({ activeRecord, setActiveRecord }), [activeRecord, setActiveRecord]);

  return <ActiveRecordContext.Provider value={value}>{children}</ActiveRecordContext.Provider>;
}

export function useActiveRecord() {
  const ctx = useContext(ActiveRecordContext);
  return ctx?.activeRecord ?? null;
}

/**
 * Call from a feature page/component once it knows which record the user is
 * on (e.g. after an edit-mode load resolves an id). Pass null (or unmount /
 * navigate away) to clear it. Safe to call even when no ActiveRecordProvider
 * is mounted (e.g. in isolated tests) — it becomes a no-op.
 */
export function useSetActiveRecord() {
  const ctx = useContext(ActiveRecordContext);
  return ctx?.setActiveRecord ?? (() => {});
}
