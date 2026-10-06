"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface DraggableColumnHandlers {
  draggable: true;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

/**
 * Manages a user-customizable column set for a report table: drag-to-reorder
 * (native HTML5 DnD) plus show/hide per column.
 *
 * - `columns` is the full ordered column list (visible + hidden) — render this
 *   for a "manage columns" picker so hidden columns can be switched back on.
 * - `visibleColumns` is `columns` filtered to the ones currently shown — map
 *   over this for both the `<thead>` and each row's cells so header and data
 *   stay in sync.
 * - Re-syncs automatically when the underlying column set changes (e.g. the
 *   user switches to a different report with a different shape), while
 *   preserving any custom order/visibility for columns that still exist.
 * - `resetColumns` restores the original order and shows every column.
 * - `toggleColumn` refuses to hide the last remaining visible column so the
 *   table can never end up with zero columns.
 */
export function useDraggableColumns(initialColumns: string[]) {
  const [columns, setColumns] = useState<string[]>(initialColumns);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragKeyRef = useRef<string | null>(null);
  const baselineRef = useRef<string[]>(initialColumns);

  useEffect(() => {
    baselineRef.current = initialColumns;
    setColumns((prev) => {
      const sameSet = prev.length === initialColumns.length && prev.every((k) => initialColumns.includes(k));
      if (sameSet) return prev;
      const kept = prev.filter((k) => initialColumns.includes(k));
      const added = initialColumns.filter((k) => !kept.includes(k));
      return [...kept, ...added];
    });
    setHiddenKeys((prev) => {
      const next = new Set(Array.from(prev).filter((k) => initialColumns.includes(k)));
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialColumns.join("")]);

  const handleDragStart = useCallback((key: string) => (event: React.DragEvent<HTMLElement>) => {
    dragKeyRef.current = key;
    setDraggingKey(key);
    event.dataTransfer.effectAllowed = "move";
    try {
      event.dataTransfer.setData("text/plain", key);
    } catch {
      /* Some browsers restrict dataTransfer access during drag; harmless to skip. */
    }
  }, []);

  const handleDragOver = useCallback((key: string) => (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverKey((current) => (current === key ? current : key));
  }, []);

  const handleDragLeave = useCallback((key: string) => () => {
    setDragOverKey((current) => (current === key ? null : current));
  }, []);

  const handleDrop = useCallback((targetKey: string) => (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const sourceKey = dragKeyRef.current;
    dragKeyRef.current = null;
    setDraggingKey(null);
    setDragOverKey(null);
    if (!sourceKey || sourceKey === targetKey) return;
    setColumns((prev) => {
      const next = [...prev];
      const from = next.indexOf(sourceKey);
      const to = next.indexOf(targetKey);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, sourceKey);
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    dragKeyRef.current = null;
    setDraggingKey(null);
    setDragOverKey(null);
  }, []);

  const getDragHandlers = useCallback((key: string): DraggableColumnHandlers => ({
    draggable: true,
    onDragStart: handleDragStart(key),
    onDragOver: handleDragOver(key),
    onDragLeave: handleDragLeave(key),
    onDrop: handleDrop(key),
    onDragEnd: handleDragEnd
  }), [handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd]);

  const toggleColumn = useCallback((key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      // Never allow hiding the last visible column — the table must always show at least one.
      const visibleCount = columns.filter((k) => !prev.has(k)).length;
      if (visibleCount <= 1) return prev;
      next.add(key);
      return next;
    });
  }, [columns]);

  const showAllColumns = useCallback(() => {
    setHiddenKeys(new Set());
  }, []);

  const resetColumns = useCallback(() => {
    setColumns(baselineRef.current);
    setHiddenKeys(new Set());
  }, []);

  const visibleColumns = useMemo(() => columns.filter((k) => !hiddenKeys.has(k)), [columns, hiddenKeys]);

  const isCustomized = hiddenKeys.size > 0
    || columns.length !== baselineRef.current.length
    || columns.some((k, i) => k !== baselineRef.current[i]);

  return {
    columns,
    visibleColumns,
    hiddenKeys,
    toggleColumn,
    showAllColumns,
    dragOverKey,
    draggingKey,
    getDragHandlers,
    resetColumns,
    isCustomized
  };
}
