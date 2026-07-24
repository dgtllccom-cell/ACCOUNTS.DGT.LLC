"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type SearchSelectOption = {
  value: string;
  label: string;
  keywords?: string;
  disabled?: boolean;
};

export function SearchSelect({
  label,
  value,
  placeholder = "Select...",
  options = [],
  disabled,
  onValueChange,
  onOpenChange,
  onSearchValueChange,
  createLabel = "+ New",
  onCreateNew,
  triggerClassName,
  className
}: {
  label?: string;
  value: string;
  placeholder?: string;
  options: SearchSelectOption[];
  disabled?: boolean;
  onValueChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  onSearchValueChange?: (value: string) => void;
  createLabel?: string;
  onCreateNew?: () => void | Promise<void>;
  createButtonPlacement?: "modal" | "trigger" | "both" | "below";
  triggerClassName?: string;
  className?: string;
}) {
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
    const match = uniqueOptions.find((opt) => opt.value === value);
    return match?.label ?? "";
  }, [uniqueOptions, value]);

  function setOpenSafe(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div className={cn("flex flex-col w-full", label && "space-y-1.5", className)}>
      {label && <Label className="text-[11px] font-semibold text-muted-foreground">{label}</Label>}
      <Popover open={open} onOpenChange={setOpenSafe}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-xs shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              !selectedLabel && "text-muted-foreground",
              triggerClassName
            )}
          >
            <span className="truncate flex-1 text-left mr-2">
              {selectedLabel || placeholder}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onValueChange("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      onValueChange("");
                    }
                  }}
                  className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground cursor-pointer transition"
                  title="Clear selection"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0" align="start">
          <Command
            filter={(value, search, keywords) => {
              const extendValue = value + " " + (keywords?.join(" ") ?? "");
              if (extendValue.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput 
              placeholder="Search..." 
              onValueChange={onSearchValueChange}
            />
            <CommandList>
              <CommandEmpty>No matches found.</CommandEmpty>
              <CommandGroup>
                {uniqueOptions.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label} // CommandItem filters on its string value
                    keywords={[opt.keywords ?? "", opt.value]}
                    disabled={opt.disabled}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpenSafe(false);
                    }}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="truncate">{opt.label}</span>
                    {value === opt.value && <Check className="h-3.5 w-3.5 text-primary ml-2 shrink-0" />}
                  </CommandItem>
                ))}
              </CommandGroup>
              {onCreateNew && (
                <>
                  <div className="h-px bg-border my-1" />
                  <CommandGroup>
                    <CommandItem
                      onSelect={async () => {
                        setOpenSafe(false);
                        await onCreateNew();
                      }}
                      className="text-xs font-bold text-primary flex items-center gap-2 py-2"
                    >
                      <span className="text-sm font-bold">+</span>
                      <span>{createLabel}</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
