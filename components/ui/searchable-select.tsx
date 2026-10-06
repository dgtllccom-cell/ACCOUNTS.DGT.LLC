"use client";

import * as React from "react";
import { SearchSelect } from "@/components/ui/search-select";

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  addOptionLabel?: string;
}

/**
 * @deprecated Thin adapter over the canonical {@link SearchSelect}. Historically this was a
 * SECOND, near-identical Popover+Command dropdown (its own faint chevron etc.), which let the
 * dropdown look/behaviour drift from the rest of the ERP. It now delegates entirely to the ONE
 * shared SearchSelect, so every dropdown renders the same visible control and behaves the same.
 * Existing callers keep this (value / onChange / options / addOptionLabel) API unchanged; new
 * code should import `SearchSelect` directly.
 *
 * Behaviour preserved from the old implementation:
 *  - single-arg `onChange(value)`
 *  - `className` applied to the trigger footprint
 *  - a not-in-list current value still shows as "<value> (Current)"
 *  - `addOptionLabel` renders a "+ …" item that emits the `__ADD_NEW__` sentinel
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  disabled = false,
  addOptionLabel
}: SearchableSelectProps) {
  // Preserve the legacy "show the current value even when it isn't in the option list" behaviour.
  const mergedOptions = React.useMemo(() => {
    const opts = options || [];
    if (value && !opts.some((o) => o.value === value)) {
      return [{ value, label: `${value} (Current)` }, ...opts];
    }
    return opts;
  }, [options, value]);

  return (
    <SearchSelect
      value={value}
      onValueChange={onChange}
      options={mergedOptions}
      placeholder={placeholder}
      disabled={disabled}
      // Old component had no wrapper element, so the caller's className shaped the field footprint
      // directly. Apply it to both the wrapper and the trigger so width/z-index/text utilities land
      // the same way they used to.
      className={className}
      triggerClassName={className}
      emptyLabel="No results found."
      createLabel={addOptionLabel}
      onCreateNew={addOptionLabel ? () => onChange("__ADD_NEW__") : undefined}
      createButtonPlacement="modal"
    />
  );
}
