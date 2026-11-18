"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Pencil, Plus } from "lucide-react";

export type AccountCategoryPickerItem = { id: string; code: string; name: string };

type Props = {
  id?: string;
  /** Selected category code (the value stored on the account). */
  value: string;
  items: AccountCategoryPickerItem[];
  placeholder: string;
  addNewLabel: string;
  editLabel: string;
  /** Pencil on each row. Only shown when the signed-in user may edit categories (the PATCH route enforces the same rule). */
  canEdit: boolean;
  onSelect: (item: AccountCategoryPickerItem) => void;
  onAddNew: () => void;
  onEdit: (item: AccountCategoryPickerItem) => void;
};

/**
 * Category picker with an edit pencil on every row. A native <select> cannot hold a button per option,
 * so this list replaces it. Selecting a row stores its code, exactly as the select did.
 */
export function AccountCategoryPicker({ id, value, items, placeholder, addNewLabel, editLabel, canEdit, onSelect, onAddNew, onEdit }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = items.find((item) => item.code === value);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-start text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">
          {selected ? (
            <>
              {selected.name} <span className="font-mono text-xs text-slate-500">({selected.code})</span>
            </>
          ) : (
            <span className="text-slate-500">{value ? value : placeholder}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute start-0 end-0 z-50 mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          {items.map((item) => {
            const isSelected = item.code === value;
            return (
              <div
                key={item.id}
                role="option"
                aria-selected={isSelected}
                className="flex items-center gap-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-start text-sm"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {isSelected && <Check className="h-4 w-4" />}
                  </span>
                  <span className="truncate font-semibold">{item.name}</span>
                  <span className="ms-auto shrink-0 font-mono text-xs text-slate-500">{item.code}</span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={editLabel}
                    title={editLabel}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpen(false);
                      onEdit(item);
                    }}
                    className="me-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAddNew();
            }}
            className="mt-1 flex w-full items-center gap-2 border-t border-slate-200 px-2.5 py-2.5 text-start text-sm font-bold text-blue-600 hover:bg-slate-100 dark:border-slate-800 dark:text-blue-400 dark:hover:bg-slate-900"
          >
            <Plus className="h-4 w-4" />
            {addNewLabel}
          </button>
        </div>
      )}
    </div>
  );
}
