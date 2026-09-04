"use client";

/**
 * Universal ERP Date / Date-Range Picker
 * ─────────────────────────────────────
 * ONE reusable control for every "view by date" / "between two dates" need in
 * the ERP — reports, transaction history, dashboards, ledgers, HR, stock,
 * shipping/clearing, expenses, etc.
 *
 *   <ErpDatePicker mode="range" value={range} onApply={setRange} />
 *   <ErpDatePicker mode="single" value={{ from: d }} onApply={(v) => setD(v.from)} />
 *
 * Features
 *   • Single date OR From → To range
 *   • Previous / Next month navigation; dual-month view on desktop, single on mobile
 *   • Start & end highlighted, the range between them shaded
 *   • Quick ranges — Today / Yesterday / This Week / Last 7 Days / This Month /
 *     Last Month / This Year (configurable)
 *   • Clear / Reset and Apply / Update
 *   • 5 languages (EN/UR/PS/FA/AR) + correct RTL — month/day names via Intl with a
 *     forced Gregorian calendar + Latin digits
 *   • Responsive: professional calendar on desktop, reflows on tablet/mobile with
 *     no overflow
 *
 * Dates are ISO `YYYY-MM-DD` strings end to end so the same selection drives the
 * table, the totals, and Print / PDF / Excel output.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PRESETS,
  addMonths,
  cmp,
  formatErpDate,
  formatErpRange,
  fromIso,
  isBetween,
  matchPreset,
  monthGrid,
  monthLabel,
  resolvePreset,
  startOfMonth,
  todayIso,
  weekdayShortNames,
  type DateRangeValue,
  type IsoDate,
  type PresetKey,
} from "@/lib/datetime/erp-date";

export type { DateRangeValue, PresetKey } from "@/lib/datetime/erp-date";

type CommonProps = {
  /** optional language override (server-threaded); otherwise the active UI language */
  lang?: string;
  /** earliest selectable date, ISO */
  min?: IsoDate | null;
  /** latest selectable date, ISO */
  max?: IsoDate | null;
  /** show the quick-range rail. true = defaults, or pass an explicit list, false = none */
  presets?: boolean | PresetKey[];
  /** months shown side by side on desktop (1 or 2). Default 2 for range, 1 for single. */
  months?: 1 | 2;
  /** small field label rendered above the trigger */
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  size?: "sm" | "md";
  id?: string;
  /** primary action label — "Apply" (default) or "Update" */
  applyLabel?: "apply" | "update";
  /** clearing is allowed by default; set false to force a value */
  clearable?: boolean;
};

type RangeProps = CommonProps & {
  mode?: "range";
  value: DateRangeValue;
  onChange?: (v: DateRangeValue) => void;
  onApply?: (v: DateRangeValue) => void;
};
type SingleProps = CommonProps & {
  mode: "single";
  value: { from: IsoDate | null };
  onChange?: (v: { from: IsoDate | null }) => void;
  onApply?: (v: { from: IsoDate | null }) => void;
};

export type ErpDatePickerProps = RangeProps | SingleProps;

function useIsMobile(bp = 640) {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [bp]);
  return m;
}

export function ErpDatePicker(props: ErpDatePickerProps) {
  const {
    lang,
    min = null,
    max = null,
    presets = true,
    label,
    placeholder,
    disabled,
    className,
    triggerClassName,
    align = "start",
    size = "md",
    id,
    applyLabel = "apply",
    clearable = true,
  } = props;
  const mode = props.mode ?? "range";
  const s = useErpScreen("datepick", lang);
  const isMobile = useIsMobile();
  const monthsDesktop = props.months ?? (mode === "range" ? 2 : 1);
  const monthCount = isMobile ? 1 : monthsDesktop;

  const committed: DateRangeValue = useMemo(
    () => ({ from: props.value.from ?? null, to: (mode === "range" ? (props.value as DateRangeValue).to : props.value.from) ?? null }),
    [props.value, mode],
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRangeValue>(committed);
  const [view, setView] = useState<Date>(() => startOfMonth(fromIso(committed.from) ?? new Date()));
  const [error, setError] = useState<string | null>(null);
  const pickingRef = useRef<"from" | "to">("from");

  // re-sync when opened or when the external value changes
  useEffect(() => {
    if (open) {
      setDraft(committed);
      setView(startOfMonth(fromIso(committed.from) ?? fromIso(committed.to) ?? new Date()));
      setError(null);
      pickingRef.current = "from";
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const presetList: PresetKey[] = useMemo(
    () => (presets === true ? DEFAULT_PRESETS : Array.isArray(presets) ? presets : []),
    [presets],
  );
  const activePreset = useMemo(
    () => (mode === "range" ? matchPreset(draft, presetList) : null),
    [draft, presetList, mode],
  );

  const weekdays = useMemo(() => weekdayShortNames(s.lang), [s.lang]);

  const disabledDay = (iso: IsoDate) => (!!min && iso < min) || (!!max && iso > max);

  function pickDay(iso: IsoDate) {
    if (disabledDay(iso)) return;
    setError(null);
    if (mode === "single") {
      setDraft({ from: iso, to: iso });
      return;
    }
    // range
    if (pickingRef.current === "from" || !draft.from || (draft.from && draft.to)) {
      setDraft({ from: iso, to: null });
      pickingRef.current = "to";
    } else {
      if (cmp(iso, draft.from) < 0) {
        setDraft({ from: iso, to: draft.from });
      } else {
        setDraft({ from: draft.from, to: iso });
      }
      pickingRef.current = "from";
    }
  }

  function applyPreset(k: PresetKey) {
    const r = resolvePreset(k);
    setDraft(r);
    setError(null);
    if (r.from) setView(startOfMonth(fromIso(r.from)!));
    pickingRef.current = "from";
  }

  function commit() {
    if (mode === "range") {
      if (draft.from && draft.to && cmp(draft.from, draft.to) > 0) {
        setError(s.t("err_end_before_start", "End date cannot be before the start date."));
        return;
      }
      (props as RangeProps).onApply?.({ from: draft.from, to: draft.to });
      (props as RangeProps).onChange?.({ from: draft.from, to: draft.to });
    } else {
      if (!draft.from) {
        setError(s.t("err_required", "Please select a date."));
        return;
      }
      (props as SingleProps).onApply?.({ from: draft.from });
      (props as SingleProps).onChange?.({ from: draft.from });
    }
    setOpen(false);
  }

  function clear() {
    const empty: DateRangeValue = { from: null, to: null };
    setDraft(empty);
    setError(null);
    pickingRef.current = "from";
    if (mode === "range") {
      (props as RangeProps).onApply?.(empty);
      (props as RangeProps).onChange?.(empty);
    } else {
      (props as SingleProps).onApply?.({ from: null });
      (props as SingleProps).onChange?.({ from: null });
    }
    setOpen(false);
  }

  const triggerText =
    mode === "single"
      ? committed.from
        ? formatErpDate(committed.from, s.lang)
        : ""
      : formatErpRange(committed, s.lang);
  const hasValue = !!committed.from || !!committed.to;

  const Cal = ({ offset }: { offset: number }) => {
    const m = addMonths(view, offset);
    const grid = monthGrid(m);
    const monthIdx = m.getMonth();
    const t = todayIso();
    return (
      <div className="min-w-[15rem] flex-1">
        <div className="mb-2 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
          {monthLabel(m, s.lang)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {weekdays.map((w, i) => (
            <div key={i} className="pb-1 text-center text-[11px] font-medium text-slate-400">
              {w}
            </div>
          ))}
          {grid.map((iso) => {
            const d = fromIso(iso)!;
            const other = d.getMonth() !== monthIdx;
            // Selection styling only shows in the panel that owns the day, so a
            // range endpoint never appears twice across two adjacent months.
            const isFrom = !other && draft.from === iso;
            const isTo = !other && draft.to === iso;
            const between = !other && isBetween(iso, draft.from, draft.to);
            const off = disabledDay(iso);
            return (
              <button
                key={iso}
                type="button"
                disabled={off}
                onClick={() => pickDay(iso)}
                aria-label={formatErpDate(iso, s.lang)}
                aria-current={iso === t ? "date" : undefined}
                className={cn(
                  "mx-auto flex h-8 w-8 items-center justify-center rounded-md text-[13px] tabular-nums transition-colors",
                  other && "text-slate-300 dark:text-slate-600",
                  !other && "text-slate-700 dark:text-slate-200",
                  !off && !isFrom && !isTo && "hover:bg-slate-100 dark:hover:bg-slate-800",
                  between && !isFrom && !isTo && "rounded-none bg-slate-100 dark:bg-slate-800",
                  (isFrom || isTo) && "bg-slate-900 font-semibold text-white hover:bg-slate-900 dark:bg-slate-100 dark:text-slate-900",
                  isFrom && draft.to && "rounded-e-none",
                  isTo && draft.from && draft.from !== draft.to && "rounded-s-none",
                  iso === t && !isFrom && !isTo && "ring-1 ring-inset ring-slate-300 dark:ring-slate-600",
                  off && "cursor-not-allowed text-slate-200 dark:text-slate-700",
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const showClear = clearable && hasValue && !disabled;

  return (
    <div className={cn("inline-flex w-full flex-col gap-1", className)} dir={s.dir}>
      {label && <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>}
      <div className="relative w-full">
      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white text-start text-slate-800 shadow-xs transition-colors hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
              size === "sm" ? "h-9 px-2.5 text-xs" : "h-10 px-3 text-sm",
              showClear && "pe-14",
              triggerClassName,
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
              <span className={cn("truncate", !hasValue && "text-slate-400")}>
                {triggerText || placeholder || s.t(mode === "single" ? "select_date" : "select_range", mode === "single" ? "Select date" : "Select date range")}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </PopoverTrigger>
        {showClear && (
          <button
            type="button"
            aria-label={s.t("clear", "Clear")}
            onClick={clear}
            className="absolute inset-y-0 end-7 my-auto flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <PopoverContent
          align={align}
          dir={s.dir}
          className="w-auto max-w-[95vw] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className={cn("flex", isMobile ? "flex-col" : "flex-row")}>
            {presetList.length > 0 && (
              <div
                className={cn(
                  "shrink-0 gap-1 p-2",
                  isMobile
                    ? "flex flex-wrap border-b border-slate-100 dark:border-slate-800"
                    : "flex w-36 flex-col border-e border-slate-100 dark:border-slate-800",
                )}
              >
                <span className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {s.t("quick_ranges", "Quick Ranges")}
                </span>
                {presetList.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => applyPreset(k)}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-start text-xs transition-colors",
                      activePreset === k
                        ? "bg-slate-900 font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                    )}
                  >
                    {s.t(k, k.replace(/_/g, " "))}
                  </button>
                ))}
              </div>
            )}

            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label={s.t("prev_month", "Previous month")}
                  onClick={() => setView((v) => addMonths(v, -1))}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {s.isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  aria-label={s.t("next_month", "Next month")}
                  onClick={() => setView((v) => addMonths(v, 1))}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {s.isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>

              <div className={cn("flex gap-6", monthCount === 1 && "justify-center")}>
                {Array.from({ length: monthCount }, (_, i) => (
                  <Cal key={i} offset={i} />
                ))}
              </div>

              {error && (
                <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {error}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {mode === "single"
                    ? draft.from
                      ? `${s.t("selected", "Selected")}: ${formatErpDate(draft.from, s.lang)}`
                      : s.t("no_date", "No date selected")
                    : draft.from || draft.to
                      ? `${s.t("selected", "Selected")}: ${formatErpRange(draft, s.lang)}`
                      : s.t("no_date", "No date selected")}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearable ? clear : () => setOpen(false)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {clearable ? s.t("clear", "Clear") : s.t("cancel", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={commit}
                    className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    {s.t(applyLabel, applyLabel === "update" ? "Update" : "Apply")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      </div>
    </div>
  );
}
