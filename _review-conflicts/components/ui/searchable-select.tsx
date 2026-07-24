"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string; }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  addOptionLabel?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  disabled = false,
  addOptionLabel
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);

  // Deduplicate options by value
  const uniqueOptions = React.useMemo(() => {
    const seen = new Set<string>();
    return (options || []).filter((opt) => {
      if (!opt || seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    });
  }, [options]);

  const selectedLabel = React.useMemo(() => {
    return uniqueOptions.find((o) => o.value === value)?.label || value || placeholder;
  }, [uniqueOptions, value, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full h-9 items-center justify-between bg-background border border-input rounded-md px-3 py-2 text-foreground text-xs font-semibold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-900",
            className
          )}
        >
          <span className="truncate mr-2 text-left flex-1">{selectedLabel}</span>
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onChange("");
                  }
                }}
                className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground cursor-pointer transition"
                title="Clear selection"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {value && !uniqueOptions.some((o) => o.value === value) && (
                <CommandItem
                  value={value}
                  onSelect={() => setOpen(false)}
                  className="text-[11px] font-medium"
                >
                  {value} (Current)
                </CommandItem>
              )}
              {uniqueOptions.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  keywords={[opt.value]}
                  onSelect={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "text-[11px] flex items-center justify-between",
                    value === opt.value && "font-semibold bg-slate-100 dark:bg-slate-800"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && <Check className="h-3 w-3 text-primary ml-2 shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
            {addOptionLabel && (
              <>
                <div className="h-px bg-border my-1" />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onChange("__ADD_NEW__");
                      setOpen(false);
                    }}
                    className="text-[11px] font-semibold text-primary"
                  >
                    + {addOptionLabel}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
