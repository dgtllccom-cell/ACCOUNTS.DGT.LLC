"use client";

/**
 * Global ERP Calculator — one Calculator icon in the top header, available to
 * every authenticated user, everywhere in the ERP (CLAUDE.md Section E).
 *
 * Display-only: it never reads or writes any Purchase/Sales/Ledger/Journal/
 * Roznamcha/Cash Entry/Expense/Payment record, never posts an accounting
 * transaction, and has no auto-connection to accounting posting. It is a
 * floating, non-modal, draggable popup — opening it must never refresh the
 * page, navigate away, or reset/lose state in the form the user is working
 * on underneath, so it deliberately does NOT use the Dialog/Popover
 * primitives (both trap focus / dismiss on outside click); it renders its
 * own free-floating panel via a portal instead.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, Delete, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

const PANEL_WIDTH = 288;
const PANEL_HEIGHT_OPEN = 392;
const PANEL_HEIGHT_MIN = 44;

type Op = "+" | "-" | "×" | "÷" | null;

function formatDisplay(value: string): string {
  if (value === "Error") return value;
  const neg = value.startsWith("-") ? "-" : "";
  const v = neg ? value.slice(1) : value;
  const [intPart, decPart] = v.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg + withCommas + (decPart !== undefined ? "." + decPart : "");
}

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    case "÷": return b === 0 ? NaN : a / b;
    default: return b;
  }
}

export function GlobalCalculator() {
  const lang = useActiveLanguage();
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";
  const tt = (key: string, fallback: string) => t(lang, ("calc." + key) as never, fallback);

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Op>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [expression, setExpression] = useState("");

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  const clampPosition = useCallback((x: number, y: number) => {
    if (typeof window === "undefined") return { x, y };
    const maxX = Math.max(8, window.innerWidth - PANEL_WIDTH - 8);
    const maxY = Math.max(8, window.innerHeight - PANEL_HEIGHT_MIN - 8);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
  }, []);

  const openPanel = useCallback(() => {
    if (!pos && typeof window !== "undefined") {
      const rect = triggerRef.current?.getBoundingClientRect();
      const initX = rect ? Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 12) : window.innerWidth - PANEL_WIDTH - 24;
      const initY = rect ? rect.bottom + 8 : 64;
      setPos(clampPosition(initX, initY));
    }
    setOpen(true);
    setMinimized(false);
  }, [pos, clampPosition]);

  // Reposition on viewport resize so the panel never ends up off-screen.
  useEffect(() => {
    if (!open || !pos) return;
    const onResize = () => setPos((p) => (p ? clampPosition(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, pos, clampPosition]);

  // Drag handling (mouse + touch) on the title bar only.
  const beginDrag = useCallback((clientX: number, clientY: number) => {
    if (!pos) return;
    dragRef.current = { startX: clientX, startY: clientY, originX: pos.x, originY: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!open) return;
    const onMove = (clientX: number, clientY: number) => {
      const d = dragRef.current;
      if (!d) return;
      const next = clampPosition(d.originX + (clientX - d.startX), d.originY + (clientY - d.startY));
      setPos(next);
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const endDrag = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", endDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", endDrag);
    };
  }, [open, clampPosition]);

  const inputDigit = useCallback((d: string) => {
    setDisplay((cur) => {
      if (overwrite) { setOverwrite(false); return d === "." ? "0." : d; }
      if (d === "." && cur.includes(".")) return cur;
      if (cur.replace("-", "").replace(".", "").length >= 15) return cur;
      return cur === "0" && d !== "." ? d : cur + d;
    });
  }, [overwrite]);

  const applyOperator = useCallback((op: Exclude<Op, null>) => {
    setDisplay((cur) => {
      const value = parseFloat(cur);
      if (stored !== null && pendingOp && !overwrite) {
        const result = compute(stored, value, pendingOp);
        const resultStr = Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : "Error";
        setStored(Number.isFinite(result) ? result : null);
        setExpression(`${formatDisplay(resultStr)} ${op}`);
        setPendingOp(op);
        setOverwrite(true);
        return resultStr;
      }
      setStored(value);
      setPendingOp(op);
      setExpression(`${formatDisplay(cur)} ${op}`);
      setOverwrite(true);
      return cur;
    });
  }, [stored, pendingOp, overwrite]);

  const equals = useCallback(() => {
    setDisplay((cur) => {
      if (stored === null || !pendingOp) return cur;
      const value = parseFloat(cur);
      const result = compute(stored, value, pendingOp);
      setExpression(`${formatDisplay(String(stored))} ${pendingOp} ${formatDisplay(cur)} =`);
      setStored(null);
      setPendingOp(null);
      setOverwrite(true);
      return Number.isFinite(result) ? String(Math.round(result * 1e10) / 1e10) : "Error";
    });
  }, [stored, pendingOp]);

  const clearAll = useCallback(() => {
    setDisplay("0"); setStored(null); setPendingOp(null); setOverwrite(true); setExpression("");
  }, []);

  const backspace = useCallback(() => {
    setDisplay((cur) => {
      if (overwrite || cur === "Error") return cur;
      const next = cur.length > 1 ? cur.slice(0, -1) : "0";
      return next === "-" ? "0" : next;
    });
  }, [overwrite]);

  const toggleSign = useCallback(() => {
    setDisplay((cur) => (cur === "0" || cur === "Error") ? cur : (cur.startsWith("-") ? cur.slice(1) : "-" + cur));
  }, []);

  // Keyboard support while the panel is open and not minimized.
  useEffect(() => {
    if (!open || minimized) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const typingElsewhere = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable) && !panelRef.current?.contains(active);
      if (typingElsewhere) return;

      if (/^[0-9]$/.test(e.key)) { inputDigit(e.key); e.preventDefault(); return; }
      if (e.key === ".") { inputDigit("."); e.preventDefault(); return; }
      if (e.key === "+") { applyOperator("+"); e.preventDefault(); return; }
      if (e.key === "-") { applyOperator("-"); e.preventDefault(); return; }
      if (e.key === "*") { applyOperator("×"); e.preventDefault(); return; }
      if (e.key === "/") { applyOperator("÷"); e.preventDefault(); return; }
      if (e.key === "Enter" || e.key === "=") { equals(); e.preventDefault(); return; }
      if (e.key === "Backspace") { backspace(); e.preventDefault(); return; }
      if (e.key === "Escape") { setOpen(false); e.preventDefault(); return; }
      if (e.key.toLowerCase() === "c") { clearAll(); e.preventDefault(); return; }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, minimized, inputDigit, applyOperator, equals, backspace, clearAll]);

  if (!mounted) {
    return (
      <button type="button" className="relative p-1.5 rounded-full text-muted-foreground opacity-0 pointer-events-none" aria-hidden tabIndex={-1}>
        <Calculator className="h-5 w-5" />
      </button>
    );
  }

  const KEYS: { label: string; kind: "digit" | "op" | "eq" | "clear" | "back" | "sign"; value: string; className?: string }[] = [
    { label: "C", kind: "clear", value: "C" },
    { label: "±", kind: "sign", value: "±" },
    { label: "⌫", kind: "back", value: "back" },
    { label: "÷", kind: "op", value: "÷" },
    { label: "7", kind: "digit", value: "7" },
    { label: "8", kind: "digit", value: "8" },
    { label: "9", kind: "digit", value: "9" },
    { label: "×", kind: "op", value: "×" },
    { label: "4", kind: "digit", value: "4" },
    { label: "5", kind: "digit", value: "5" },
    { label: "6", kind: "digit", value: "6" },
    { label: "−", kind: "op", value: "-" },
    { label: "1", kind: "digit", value: "1" },
    { label: "2", kind: "digit", value: "2" },
    { label: "3", kind: "digit", value: "3" },
    { label: "+", kind: "op", value: "+" },
    { label: "0", kind: "digit", value: "0", className: "col-span-2" },
    { label: ".", kind: "digit", value: "." },
    { label: "=", kind: "eq", value: "=" },
  ];

  function pressKey(k: typeof KEYS[number]) {
    if (k.kind === "digit") inputDigit(k.value);
    else if (k.kind === "op") applyOperator(k.value as Exclude<Op, null>);
    else if (k.kind === "eq") equals();
    else if (k.kind === "clear") clearAll();
    else if (k.kind === "back") backspace();
    else if (k.kind === "sign") toggleSign();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={tt("open", "Calculator")}
        title={tt("open", "Calculator")}
        className={cn(
          "relative p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
          open && "bg-muted text-foreground"
        )}
      >
        <Calculator className="h-5 w-5" aria-hidden />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          dir={isRtl ? "rtl" : "ltr"}
          role="dialog"
          aria-label={tt("open", "Calculator")}
          style={{ position: "fixed", left: pos.x, top: pos.y, width: PANEL_WIDTH, zIndex: 9999 }}
          className="select-none rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden font-sans"
        >
          {/* Title bar — drag handle */}
          <div
            className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/60 border-b border-border cursor-move touch-none"
            onMouseDown={(e) => { e.preventDefault(); beginDrag(e.clientX, e.clientY); }}
            onTouchStart={(e) => { const tch = e.touches[0]; if (tch) beginDrag(tch.clientX, tch.clientY); }}
          >
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Calculator className="h-3.5 w-3.5" aria-hidden />
              {tt("title", "Calculator")}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMinimized((m) => !m)}
                aria-label={minimized ? tt("restore", "Restore") : tt("minimize", "Minimize")}
                title={minimized ? tt("restore", "Restore") : tt("minimize", "Minimize")}
                className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tt("close", "Close")}
                title={tt("close", "Close")}
                className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>

          {!minimized && (
            <div className="p-3" dir="ltr">
              {/* Display */}
              <div className="mb-3 rounded-xl bg-slate-900 dark:bg-black px-3 py-3 text-right">
                <div className="h-4 truncate text-[11px] font-medium text-slate-400" aria-hidden>
                  {expression || " "}
                </div>
                <div className={cn("truncate font-mono text-2xl font-bold text-white", display.length > 10 && "text-xl")}>
                  {formatDisplay(display)}
                </div>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-4 gap-1.5">
                {KEYS.map((k, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pressKey(k)}
                    aria-label={
                      k.kind === "clear" ? tt("clear", "Clear")
                      : k.kind === "back" ? tt("backspace", "Backspace")
                      : k.kind === "eq" ? tt("equals", "Equals")
                      : k.kind === "sign" ? tt("toggle_sign", "Toggle sign")
                      : k.label
                    }
                    className={cn(
                      "h-11 rounded-xl text-sm font-bold transition-colors active:scale-95",
                      k.className,
                      k.kind === "digit" && "bg-muted hover:bg-muted/70 text-foreground",
                      k.kind === "clear" && "bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 dark:text-rose-400",
                      (k.kind === "back" || k.kind === "sign") && "bg-muted hover:bg-muted/70 text-foreground",
                      k.kind === "op" && "bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 dark:text-blue-400",
                      k.kind === "eq" && "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
                  >
                    {k.kind === "back" ? <Delete className="mx-auto h-4 w-4" aria-hidden /> : k.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
