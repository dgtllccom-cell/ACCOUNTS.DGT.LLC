"use client";

import * as React from "react";
import { Building2, Check, ChevronDown, Eye, FileText, Loader2, Mail, MapPin, MoreVertical, Pencil, Phone, Printer, Search, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t as uiText } from "@/lib/i18n/ui";

export type SearchSelectOption = {
  value: string;
  label: string;
  keywords?: string;
  disabled?: boolean;
  // ── Rich-row / Account card display fields (all optional).
  primaryText?: string;
  secondaryText?: string;
  code?: string;
  country?: string;
  city?: string;
  branch?: string;
  avatarColor?: string;
  companyName?: string;
  category?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: string;
  initials?: string;
  avatarBgColor?: string;
  avatarTextColor?: string;
  isAccountCard?: boolean;
  onEdit?: () => void;
};

export const ACCOUNT_AVATAR_PALETTE = [
  { bg: "bg-blue-100 dark:bg-blue-950/80", text: "text-blue-700 dark:text-blue-300" },
  { bg: "bg-teal-100 dark:bg-teal-950/80", text: "text-teal-700 dark:text-teal-300" },
  { bg: "bg-pink-100 dark:bg-pink-950/80", text: "text-purple-700 dark:text-purple-300" },
  { bg: "bg-amber-100 dark:bg-amber-950/80", text: "text-amber-800 dark:text-amber-300" },
  { bg: "bg-indigo-100 dark:bg-indigo-950/80", text: "text-indigo-700 dark:text-indigo-300" },
  { bg: "bg-emerald-100 dark:bg-emerald-950/80", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-rose-100 dark:bg-rose-950/80", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-sky-100 dark:bg-sky-950/80", text: "text-sky-700 dark:text-sky-300" },
];

export function accountAvatarStyleFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCOUNT_AVATAR_PALETTE[hash % ACCOUNT_AVATAR_PALETTE.length];
}

const AVATAR_PALETTE = [
  "bg-blue-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500",
  "bg-amber-500", "bg-teal-500", "bg-slate-400", "bg-indigo-500"
];

function avatarColorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function SearchSelect({
  label,
  value,
  placeholder,
  options = [],
  disabled,
  loading = false,
  onValueChange,
  onOpenChange,
  onSearchValueChange,
  createLabel,
  onCreateNew,
  onCreateWithSearch,
  createButtonPlacement = "below",
  triggerClassName,
  className,
  searchPlaceholder,
  emptyLabel,
  viewTitle,
  editTitle,
  printTitle,
  // Per-option View/Edit/Print actions (e.g. Master pickers: view/edit/print the
  // underlying record directly from the dropdown, via a compact 3-dot menu).
  onViewOption,
  onEditOption,
  onPrintOption,
  // Opt-in compact "master record" row layout — avatar + name/sub-line + code +
  // branch + country, matching the standardized ERP master-selector design.
  // Off by default so every existing plain combobox usage is unaffected.
  richList = false,
  accountCards = false,
  pageSize = 50
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
  onCreateWithSearch?: (query: string) => void | Promise<void>;
  createButtonPlacement?: "modal" | "trigger" | "both" | "below" | "inside";
  triggerClassName?: string;
  className?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  viewTitle?: string;
  editTitle?: string;
  printTitle?: string;
  onViewOption?: (value: string) => void;
  onEditOption?: (value: string) => void;
  onPrintOption?: (value: string) => void;
  richList?: boolean;
  accountCards?: boolean;
  pageSize?: number;
}) {
  const language = useActiveLanguage();
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const isAccountCardMode = accountCards || (options || []).some((opt) => opt && (opt.isAccountCard || (opt.code && (opt.companyName || opt.phone || opt.address || opt.email))));
  const resolvedPlaceholder = placeholder ?? uiText(language, "common.select");
  const defaultSearchPlaceholder = isAccountCardMode
    ? (language === "ur"
        ? "گاہک کا نام، اکاؤنٹ نمبر، کمپنی، فون یا پتہ تلاش کریں..."
        : language === "ar"
        ? "أدخل اسم العميل، رقم الحساب، الشركة، الهاتف أو العنوان..."
        : language === "fa"
        ? "نام مشتری، شماره حساب، شرکت، شماره تماس یا آدرس..."
        : language === "ps"
        ? "د پیرودونکي نوم، حساب شمیره، شرکت، تلیفون یا ادرس دننه کړئ..."
        : "Enter customer name, account number, company, phone or address...")
    : uiText(language, "common.search");
  const resolvedSearchPlaceholder = searchPlaceholder ?? defaultSearchPlaceholder;
  const resolvedEmptyLabel = emptyLabel ?? uiText(language, "common.no_matches_found");
  const resolvedViewTitle = viewTitle ?? uiText(language, "common.view");
  const resolvedEditTitle = editTitle ?? uiText(language, "common.edit");
  const resolvedPrintTitle = printTitle ?? uiText(language, "common.print");
  const resolvedCreateLabel = (createLabel ?? uiText(language, "common.new")).replace(/^\+\s*/, "");
  const [visibleCount, setVisibleCount] = React.useState(pageSize);
  const [openActionsFor, setOpenActionsFor] = React.useState<string | null>(null);

  // Deduplicate options by value
  const uniqueOptions = React.useMemo(() => {
    const seen = new Set<string>();
    return (options || []).filter((opt) => {
      if (!opt || seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    });
  }, [options]);

  React.useEffect(() => {
    setVisibleCount(pageSize);
  }, [searchQuery, pageSize]);

  // richList only: replicate the same match logic as the `Command` filter below,
  // computed here so we can slice for pagination while still searching the FULL
  // list (not just whatever's currently visible).
  const matchingOptions = React.useMemo(() => {
    if (!richList && !isAccountCardMode) return uniqueOptions;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return uniqueOptions;
    return uniqueOptions.filter((opt) => {
      const haystack = [
        opt.label,
        opt.keywords,
        opt.primaryText,
        opt.code,
        opt.companyName,
        opt.category,
        opt.phone,
        opt.email,
        opt.address,
        opt.city,
        opt.branch,
        opt.country,
        opt.secondaryText
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [richList, isAccountCardMode, uniqueOptions, searchQuery]);

  const displayOptions = React.useMemo(() => {
    if (!richList && !isAccountCardMode) return uniqueOptions;
    return matchingOptions.slice(0, visibleCount);
  }, [richList, isAccountCardMode, matchingOptions, visibleCount]);

  const selectedLabel = React.useMemo(() => {
    const match = uniqueOptions.find((opt) => opt.value === value);
    return match?.label ?? "";
  }, [uniqueOptions, value]);

  function setOpenSafe(next: boolean) {
    setOpen(next);
    if (!next) setSearchQuery("");
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
            title={selectedLabel || resolvedPlaceholder}
            className={cn(
              "group flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background py-2 ps-3 pe-1.5 text-xs shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              !selectedLabel && "text-muted-foreground",
              triggerClassName
            )}
          >
            <span className="truncate flex-1 text-left me-2 font-medium" title={selectedLabel || resolvedPlaceholder}>
              {selectedLabel || resolvedPlaceholder}
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
                  className="inline-flex items-center justify-center !min-h-0 !min-w-0 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground cursor-pointer transition"
                  title={uiText(language, "common.clear_selection")}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
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
          className={cn(
            "w-[var(--radix-popover-trigger-width)] p-0 rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 isolate z-[999999]",
            isAccountCardMode
              ? "min-w-[360px] sm:min-w-[580px] max-w-[660px]"
              : richList
              ? "min-w-[360px] sm:min-w-[520px]"
              : "min-w-[320px]"
          )}
          align="start"
          style={{ backgroundColor: "var(--card, #ffffff)", opacity: 1 }}
        >
          <Command
            className="bg-white dark:bg-slate-950 opacity-100"
            shouldFilter={!richList && !isAccountCardMode}
            filter={(value, search, keywords) => {
              const extendValue = value + " " + (keywords?.join(" ") ?? "");
              if (extendValue.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput
              placeholder={resolvedSearchPlaceholder}
              value={searchQuery}
              onValueChange={(q) => {
                setSearchQuery(q);
                onSearchValueChange?.(q);
              }}
              className="bg-slate-50 dark:bg-slate-900"
            />
            <CommandList className="bg-white dark:bg-slate-950 opacity-100 max-h-[380px] overflow-y-auto">
              <CommandEmpty>
                <div className="py-3 px-3 text-center space-y-2">
                  <div className="text-xs text-muted-foreground">{resolvedEmptyLabel}</div>
                  {(onCreateWithSearch || onCreateNew) && searchQuery.trim() && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const q = searchQuery.trim();
                          setOpenSafe(false);
                          if (onCreateWithSearch) {
                            await onCreateWithSearch(q);
                          } else if (onCreateNew) {
                            await onCreateNew();
                          }
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                      >
                        <span className="text-sm font-black">+</span>
                        <span className="truncate">
                          {language === "ur"
                            ? `نیا شخص / ملازم ماسٹر بنائیں: "${searchQuery.trim()}"`
                            : language === "ps"
                            ? `نوی شخص / کارمند ماسټر جوړ کړئ: "${searchQuery.trim()}"`
                            : language === "fa"
                            ? `ثبت پرونده اصلی شخص جدید: "${searchQuery.trim()}"`
                            : language === "ar"
                            ? `إنشاء سجل شخص رئيسي جديد: "${searchQuery.trim()}"`
                            : `+ Create New Person Master: "${searchQuery.trim()}"`}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </CommandEmpty>
              <CommandGroup className="bg-white dark:bg-slate-950 opacity-100 p-1.5 space-y-1.5">
                {(isAccountCardMode || richList ? displayOptions : uniqueOptions).map((opt) => {
                  const isSelected = value === opt.value;
                  const isCard = isAccountCardMode || opt.isAccountCard || Boolean(opt.code && (opt.companyName || opt.phone || opt.address || opt.email));
                  const avatarStyle = accountAvatarStyleFor(opt.primaryText || opt.label);
                  const initials = opt.initials || initialsFor(opt.primaryText || opt.label);
                  const statusRaw = opt.status || "Active";
                  const isActive = statusRaw.toLowerCase() === "active";
                  // the status is a value: shown in the selected language
                  const statusLabel = isActive ? uiText(language, "common.active", "Active") : statusRaw.toLowerCase() === "inactive" ? uiText(language, "common.inactive", "Inactive") : statusRaw;

                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label ?? String(opt.value ?? "")}
                      keywords={[
                        opt.keywords ?? "",
                        opt.primaryText ?? "",
                        opt.code ?? "",
                        opt.companyName ?? "",
                        opt.phone ?? "",
                        opt.email ?? "",
                        opt.address ?? "",
                        String(opt.value ?? "")
                      ]}
                      disabled={opt.disabled}
                      onSelect={() => {
                        onValueChange(opt.value);
                        setOpenSafe(false);
                      }}
                      className={cn(
                        "cursor-pointer transition-all",
                        isCard
                          ? cn(
                              "flex flex-col items-stretch p-3 rounded-xl border mb-2",
                              isSelected
                                ? "bg-blue-50/80 dark:bg-blue-950/50 border-blue-400 dark:border-blue-600 shadow-xs"
                                : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 shadow-2xs"
                            )
                          : cn("flex justify-between items-center text-xs", richList && "py-2.5 px-3")
                      )}
                      title={opt.label}
                    >
                      {isCard ? (
                        <div className="flex items-start gap-3 w-full text-left">
                          {/* Left Avatar Badge */}
                          <div
                            className={cn(
                              "h-12 w-12 shrink-0 rounded-xl flex items-center justify-center font-bold text-sm tracking-wide shadow-2xs border border-black/5 dark:border-white/10",
                              opt.avatarBgColor || avatarStyle.bg,
                              opt.avatarTextColor || avatarStyle.text
                            )}
                          >
                            {initials}
                          </div>

                          {/* Center/Right Content */}
                          <div className="flex-1 min-w-0">
                            {/* Row 1: Name + Status Badge + Edit Button */}
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 truncate"
                                title={opt.primaryText || opt.label}
                              >
                                {opt.primaryText || opt.label}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold tracking-wide",
                                    isActive
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60"
                                  )}
                                >
                                  {statusLabel}
                                </span>
                                {(opt.onEdit || onEditOption) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (opt.onEdit) opt.onEdit();
                                      else if (onEditOption) onEditOption(opt.value);
                                    }}
                                    className="p-1 rounded-lg border border-blue-200 dark:border-blue-900/60 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition cursor-pointer"
                                    title={resolvedEditTitle}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Document / Account No | Company Name / Category */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mt-1">
                              {opt.code && (
                                <span className="inline-flex items-center gap-1 font-mono font-medium text-blue-600 dark:text-blue-400">
                                  <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span>{opt.code}</span>
                                </span>
                              )}
                              {opt.code && (opt.companyName || opt.category || opt.secondaryText) && (
                                <span className="text-slate-300 dark:text-slate-600 select-none">|</span>
                              )}
                              {(opt.companyName || opt.secondaryText) && (
                                <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-normal truncate">
                                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{opt.companyName || opt.secondaryText}</span>
                                </span>
                              )}
                              {opt.category && !opt.companyName && !opt.secondaryText && (
                                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-normal truncate">
                                  <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                                  <span>{opt.category}</span>
                                </span>
                              )}
                            </div>

                            {/* Row 3: Mobile / Phone | Email */}
                            {(opt.phone || opt.email) && (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400 mt-1">
                                {opt.phone && (
                                  <span className="inline-flex items-center gap-1 font-normal">
                                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span dir="ltr">{opt.phone}</span>
                                  </span>
                                )}
                                {opt.phone && opt.email && (
                                  <span className="text-slate-300 dark:text-slate-600 select-none">|</span>
                                )}
                                {opt.email && (
                                  <span className="inline-flex items-center gap-1 font-normal truncate">
                                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{opt.email}</span>
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Row 4: Address / Location */}
                            {(opt.address || opt.country || opt.city || opt.branch) && (
                              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">
                                  {opt.address || [opt.branch, opt.city, opt.country].filter(Boolean).join(", ")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : richList ? (
                        <>
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                                opt.avatarColor || avatarColorFor(opt.primaryText || opt.label)
                              )}
                            >
                              {initialsFor(opt.primaryText || opt.label)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[11.5px] font-bold text-blue-700 dark:text-blue-400" title={opt.primaryText || opt.label}>
                                {opt.primaryText || opt.label}
                              </div>
                              {opt.secondaryText && (
                                <div className="truncate text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">{opt.secondaryText}</div>
                              )}
                            </div>
                            {opt.code && (
                              <span className="hidden shrink-0 font-mono text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 sm:inline">
                                {opt.code}
                              </span>
                            )}
                            {opt.branch && (
                              <span className="hidden shrink-0 text-[10.5px] font-medium text-slate-500 dark:text-slate-400 md:inline">
                                {opt.branch}
                              </span>
                            )}
                            {opt.country && (
                              <span className="hidden shrink-0 text-[10.5px] font-medium text-slate-500 dark:text-slate-400 lg:inline">
                                {opt.country}
                              </span>
                            )}
                          </div>
                          <span className="flex shrink-0 items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                            {value === opt.value && <Check className="h-3.5 w-3.5 text-primary" />}
                            {(onViewOption || onEditOption || onPrintOption) && (
                              <SearchSelectRowActions
                                optionValue={opt.value}
                                open={openActionsFor === opt.value}
                                onOpenChange={(next) => setOpenActionsFor(next ? opt.value : null)}
                                onView={onViewOption ? () => { setOpenSafe(false); onViewOption(opt.value); } : undefined}
                                onEdit={onEditOption ? () => { setOpenSafe(false); onEditOption(opt.value); } : undefined}
                                onPrint={onPrintOption ? () => { setOpenSafe(false); onPrintOption(opt.value); } : undefined}
                                viewLabel={resolvedViewTitle}
                                editLabel={resolvedEditTitle}
                                printLabel={resolvedPrintTitle}
                              />
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="truncate" title={opt.label}>{opt.label}</span>
                          <span className="flex items-center gap-1 shrink-0 ml-2">
                            {value === opt.value && <Check className="h-3.5 w-3.5 text-primary" />}
                            {onViewOption && (
                              <span
                                role="button"
                                tabIndex={0}
                                title={resolvedViewTitle}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenSafe(false);
                                  onViewOption(opt.value);
                                }}
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground hover:text-foreground cursor-pointer transition"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {richList && matchingOptions.length > displayOptions.length && (
                <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setVisibleCount((n) => n + pageSize); }}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    {uiText(language, "common.load_more", "Load more")} ({displayOptions.length} / {matchingOptions.length})
                  </button>
                </div>
              )}
              {richList && matchingOptions.length > 0 && matchingOptions.length <= displayOptions.length && (
                <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-1.5 text-center text-[10.5px] font-semibold text-slate-400">
                  {uiText(language, "common.showing_of_results", "Showing {shown} of {total} results")
                    .replace("{shown}", String(displayOptions.length))
                    .replace("{total}", String(matchingOptions.length))}
                </div>
              )}
              {(onCreateWithSearch || onCreateNew) && searchQuery.trim() && !uniqueOptions.some(o => o.label.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                <>
                  <div className="h-px bg-border my-1" />
                  <CommandGroup>
                    <CommandItem
                      onSelect={async () => {
                        const q = searchQuery.trim();
                        setOpenSafe(false);
                        if (onCreateWithSearch) {
                          await onCreateWithSearch(q);
                        } else if (onCreateNew) {
                          await onCreateNew();
                        }
                      }}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center gap-2 py-2 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                    >
                      <span className="text-sm font-bold">+</span>
                      <span>
                        {language === "ur"
                          ? `نیا شخص شامل کریں: "${searchQuery.trim()}"`
                          : `+ Create New Person: "${searchQuery.trim()}"`}
                      </span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
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
                      <span>{resolvedCreateLabel}</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {onCreateNew && (createButtonPlacement === "below" || createButtonPlacement === "both") && (
        <div className={cn("mt-1", richList ? "flex justify-center" : "flex justify-start")}>
          <button
            type="button"
            disabled={disabled}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              await onCreateNew();
            }}
            className={cn(
              richList
                ? "inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 cursor-pointer disabled:opacity-50 transition"
                : "inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer disabled:opacity-50 transition"
            )}
          >
            <span className="text-sm font-black">+</span>
            <span>{resolvedCreateLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Compact 3-dot kebab menu for a rich-list row's View/Edit/Print actions. */
function SearchSelectRowActions({
  optionValue,
  open,
  onOpenChange,
  onView,
  onEdit,
  onPrint,
  viewLabel,
  editLabel,
  printLabel
}: {
  optionValue: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onView?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
  viewLabel: string;
  editLabel: string;
  printLabel: string;
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onOpenChange(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenChange(!open); }}
        className="flex h-6 w-6 items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition"
        aria-label={optionValue}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[9999999] mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
          {onView && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenChange(false); onView(); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">
              <Eye className="h-3 w-3" /> {viewLabel}
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenChange(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">
              <Pencil className="h-3 w-3" /> {editLabel}
            </button>
          )}
          {onPrint && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenChange(false); onPrint(); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">
              <Printer className="h-3 w-3" /> {printLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
