"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Reusable column-customisation state for any ERP table / register / report.
 *
 * Screen table ↔ Report preview ↔ Print/PDF stay in sync because every consumer
 * reads the SAME `visibleColumns` list this hook returns — pass it to the `<thead>`,
 * the row cells, and the print engine's `columns` prop.
 *
 * - `allColumns`      : the full, ordered column set for this table (stable `key`s).
 * - `permittedKeys`   : keys the current user is allowed to see (backend-decided).
 *                       Anything not in this list never appears — hiding is a view
 *                       preference, but a forbidden field can never be switched on.
 * - `storageKey`      : unique per table/report; the hook namespaces it per viewer.
 *
 * Layout (visible + order + widths) persists to localStorage; named "saved views"
 * (Default / Admin / User / Print / any custom name) persist alongside.
 */
export type ColumnPref = { key: string; label: string; width?: number };

type Layout = { visible: string[]; order: string[]; widths?: Record<string, number> };

const isBrowser = () => typeof window !== "undefined";

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : (v as T);
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage disabled / full — layout still works for this session */
  }
}

export function useReportColumnPrefs(opts: {
  storageKey: string;
  viewerId?: string | null;
  allColumns: ColumnPref[];
  permittedKeys?: string[] | null;
}) {
  const { storageKey, viewerId, allColumns, permittedKeys } = opts;

  const permitted = useMemo(() => {
    const allowed = permittedKeys && permittedKeys.length ? new Set(permittedKeys) : null;
    return allowed ? allColumns.filter((c) => allowed.has(c.key)) : allColumns;
  }, [allColumns, permittedKeys]);

  const permittedKeySet = useMemo(() => new Set(permitted.map((c) => c.key)), [permitted]);
  const defaultOrder = useMemo(() => permitted.map((c) => c.key), [permitted]);

  const layoutKey = `erp-report-columns:${viewerId || "anonymous"}:${storageKey}`;
  const viewsKey = `erp-report-views:${viewerId || "anonymous"}:${storageKey}`;

  const [order, setOrder] = useState<string[]>(defaultOrder);
  const [visible, setVisible] = useState<string[]>(defaultOrder);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [savedViews, setSavedViews] = useState<Record<string, Layout>>({});
  const [loaded, setLoaded] = useState(false);

  // Load persisted layout + views, reconciled against what's currently permitted.
  useEffect(() => {
    const saved = readJson<Layout | null>(layoutKey, null);
    if (saved && Array.isArray(saved.order)) {
      const ord = [
        ...saved.order.filter((k) => permittedKeySet.has(k)),
        ...defaultOrder.filter((k) => !saved.order.includes(k)),
      ];
      const vis = (saved.visible || defaultOrder).filter((k) => permittedKeySet.has(k));
      setOrder(ord);
      setVisible(vis.length ? vis : defaultOrder);
      setWidths(saved.widths || {});
    } else {
      setOrder(defaultOrder);
      setVisible(defaultOrder);
    }
    setSavedViews(readJson<Record<string, Layout>>(viewsKey, {}));
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, viewsKey, defaultOrder.join("|")]);

  // Persist the working layout on change.
  useEffect(() => {
    if (!loaded || !visible.length) return;
    writeJson(layoutKey, { visible, order, widths });
  }, [visible, order, widths, loaded, layoutKey]);

  const toggle = useCallback((key: string) => {
    setVisible((cur) => (cur.includes(key) ? (cur.length === 1 ? cur : cur.filter((k) => k !== key)) : [...cur, key]));
  }, []);

  const move = useCallback((key: string, dir: -1 | 1) => {
    setOrder((cur) => {
      const i = cur.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const setWidth = useCallback((key: string, px: number) => {
    setWidths((cur) => ({ ...cur, [key]: Math.max(40, Math.round(px)) }));
  }, []);

  const reset = useCallback(() => {
    setOrder(defaultOrder);
    setVisible(defaultOrder);
    setWidths({});
  }, [defaultOrder]);

  const applyView = useCallback(
    (name: string) => {
      const v = savedViews[name];
      if (!v) return;
      const ord = [
        ...v.order.filter((k) => permittedKeySet.has(k)),
        ...defaultOrder.filter((k) => !v.order.includes(k)),
      ];
      const vis = v.visible.filter((k) => permittedKeySet.has(k));
      setOrder(ord);
      setVisible(vis.length ? vis : defaultOrder);
      setWidths(v.widths || {});
    },
    [savedViews, permittedKeySet, defaultOrder],
  );

  const saveView = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      const next = { ...savedViews, [clean]: { visible, order, widths } };
      setSavedViews(next);
      writeJson(viewsKey, next);
    },
    [savedViews, visible, order, widths, viewsKey],
  );

  const deleteView = useCallback(
    (name: string) => {
      const next = { ...savedViews };
      delete next[name];
      setSavedViews(next);
      writeJson(viewsKey, next);
    },
    [savedViews, viewsKey],
  );

  const orderedColumns = useMemo(
    () => order.map((k) => permitted.find((c) => c.key === k)).filter(Boolean) as ColumnPref[],
    [order, permitted],
  );
  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => visible.includes(c.key)).map((c) => ({ ...c, width: widths[c.key] ?? c.width })),
    [orderedColumns, visible, widths],
  );

  return {
    loaded,
    orderedColumns,
    visibleColumns,
    visibleKeys: visible,
    widths,
    savedViewNames: Object.keys(savedViews),
    toggle,
    move,
    setWidth,
    reset,
    applyView,
    saveView,
    deleteView,
  };
}
