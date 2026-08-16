"use client";

import * as React from "react";
import { Check, ChevronDown, Eye, Loader2, Pencil, Search, X } from "lucide-react";
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
  loading = false,
  onValueChange,
  onOpenChange,
  onSearchValueChange,
  createLabel = "+ New",
  onCreateNew,
  createButtonPlacement = "below",
  triggerClassName,
  className,
  // Localizable strings for the search popover itself — default to the pre-existing English so
  // every other caller of this shared component keeps working unchanged; pass these to localize.
  searchPlaceholder = "Search...",
  emptyLabel = "No matches found.",
  viewTitle = "View Details",
  editTitle = "Edit",
  // Per-option View/Edit actions (e.g. Master pickers: view/edit the underlying record directly from the dropdown)
  onViewOption,
  onEditOption
}: {
  label?: string;
  value: string;
  placeholder?: string;
  options: SearchSelectOption[];
  disabled?: boolean;
  loading?: boolean;
  onValueChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  onSearchValueChange?: (value: string) => void;
  createLabel?: string;
  onCreateNew?: () => void | Promise<void>;
  createButtonPlacement?: "modal" | "trigger" | "both" | "below";
  triggerClassName?: string;
  className?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  viewTitle?: string;
  editTitle?: string;
  onViewOption?: (value: string) => void;
  onEditOption?: (value: string) => void;
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

  const displayCreateLabel = React.useMemo(() => {
    if (!createLabel) return "";
    return createLabel.replace(/^\+\s*/, "");
  }, [createLabel]);

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
            title={selectedLabel || placeholder}
            className={cn(
              "group flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background py-2 ps-3 pe-1.5 text-xs shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              !selectedLabel && "text-muted-foreground",
              triggerClassName
            )}
          >
            <span className="truncate flex-1 text-left me-2 font-medium" title={selectedLabel || placeholder}>
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
              {/* Explicit dropdown affordance: a bordered caret button so the field reads as a
                  selectable dropdown (not a read-only input) — consistent across the whole ERP. */}
              <span
                aria-hidden
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-colors shadow-2xs",
                  !disabled && "group-hover:bg-slate-200 dark:group-hover:bg-slate-700 group-hover:border-slate-300 dark:group-hover:border-slate-600 group-hover:text-slate-900 dark:group-hover:text-white"
                )}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 stroke-[2.5]" />
                )}
              </span>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0 rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 !bg-opacity-100 isolate z-[999999]"
          align="start"
        >
          <Command
            className="bg-white dark:bg-slate-950"
            filter={(value, search, keywords) => {
              const extendValue = value + " " + (keywords?.join(" ") ?? "");
              if (extendValue.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput
              placeholder={searchPlaceholder}
              onValueChange={onSearchValueChange}
              className="bg-slate-50 dark:bg-slate-900"
            />
            <CommandList className="bg-white dark:bg-slate-950 max-h-[300px] overflow-y-auto">
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup className="bg-white dark:bg-slate-950">
                {uniqueOptions.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    // Coerce to strings: cmdk runs `keywords.map(s => s.trim())` and trims the
                    // item value, so a null/undefined value or label (real DB rows can have them)
                    // would throw "Cannot read properties of undefined (reading 'trim')" and crash
                    // the whole page. Normalizing here keeps one safe shared dropdown ERP-wide.
                    value={opt.label ?? String(opt.value ?? "")} // CommandItem filters on its string value
                    keywords={[opt.keywords ?? "", String(opt.value ?? "")]}
                    disabled={opt.disabled}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpenSafe(false);
                    }}
                    className="flex justify-between items-center text-xs"
                    title={opt.label}
                  >
                    <span className="truncate" title={opt.label}>{opt.label}</span>
                    <span className="flex items-center gap-1 shrink-0 ml-2">
                      {value === opt.value && <Check className="h-3.5 w-3.5 text-primary" />}
                      {onViewOption && (
                        <span
                          role="button"
                          tabIndex={0}
                          title={viewTitle}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenSafe(false);
                            onViewOption(opt.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setOpenSafe(false);
                              onViewOption(opt.value);
                            }
                          }}
                          className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition"
                        >
                          <Eye className="h-3 w-3" />
                        </span>
                      )}
                      {onEditOption && (
                        <span
                          role="button"
                          tabIndex={0}
                          title={editTitle}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenSafe(false);
                            onEditOption(opt.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setOpenSafe(false);
                              onEditOption(opt.value);
                            }
                          }}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-muted-foreground hover:text-primary cursor-pointer transition"
                        >
                          <Pencil className="h-3 w-3" />
                        </span>
                      )}
                    </span>
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
                      <span>{displayCreateLabel}</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {onCreateNew && (createButtonPlacement === "below" || createButtonPlacement === "both") && (
        <div className="mt-1 flex justify-start">
          <button
            type="button"
            disabled={disabled}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              await onCreateNew();
            }}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer disabled:opacity-50 transition"
          >
            <span className="text-sm font-black">+</span>
            <span>{displayCreateLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
