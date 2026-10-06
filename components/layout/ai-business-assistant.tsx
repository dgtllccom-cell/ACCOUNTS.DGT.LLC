"use client";

/**
 * AI Business Assistant — one icon in the global header, available to every
 * authenticated user (CLAUDE.md Master Requirement Section B).
 *
 * Read-only, permission-aware natural-language query over REAL ERP data:
 * every answer is fetched from POST /api/erp/ai/query, which only ever
 * calls the already-scoped Financial Statement / Business Summary report
 * functions for the caller's own session (lib/ai/erp-assistant.ts) — RBAC
 * is enforced server-side exactly like every other report endpoint. This
 * widget itself never calls a create/update/delete endpoint and never will:
 * it is a pure chat-style reader, following the same non-modal floating
 * portal pattern as GlobalCalculator (Section E) so opening it never
 * disturbs the page underneath.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Minus, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

const PANEL_WIDTH = 340;
const PANEL_HEIGHT_MIN = 44;
const PANEL_MAX_HEIGHT = 480;

type ChatMessage = { role: "user" | "assistant"; text: string; refused?: boolean };

export function AiBusinessAssistant() {
  const lang = useActiveLanguage();
  const isRtl = lang === "ur" || lang === "ar" || lang === "fa" || lang === "ps";
  const tt = (key: string, fallback: string) => t(lang, ("aiassist." + key) as never, fallback);

  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open || !pos) return;
    const onResize = () => setPos((p) => (p ? clampPosition(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, pos, clampPosition]);

  const beginDrag = useCallback((clientX: number, clientY: number) => {
    if (!pos) return;
    dragRef.current = { startX: clientX, startY: clientY, originX: pos.x, originY: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!open) return;
    const onMove = (clientX: number, clientY: number) => {
      const d = dragRef.current;
      if (!d) return;
      setPos(clampPosition(d.originX + (clientX - d.startX), d.originY + (clientY - d.startY)));
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY); };
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text?: string) => {
    const q = (text ?? question).trim();
    if (!q || loading) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/erp/ai/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, lang })
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);
      const d = j.data;
      setMessages((m) => [...m, { role: "assistant", text: d.answer, refused: d.intent === "write_refused" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: tt("error", "Sorry, I couldn't answer that right now.") }]);
    } finally {
      setLoading(false);
    }
  }, [question, loading, lang, tt]);

  const EXAMPLES = [
    tt("ex_profit", "What is our net profit this year?"),
    tt("ex_balance", "What is our balance sheet position?"),
    tt("ex_cash", "What is our cash position?"),
    tt("ex_summary", "What is our sales and purchase summary?")
  ];

  if (!mounted) {
    return (
      <button type="button" className="relative p-1.5 rounded-full text-muted-foreground opacity-0 pointer-events-none" aria-hidden tabIndex={-1}>
        <Bot className="h-5 w-5" />
      </button>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={tt("open", "Ask the AI Business Assistant")}
        title={tt("open", "Ask the AI Business Assistant")}
        className={cn(
          "relative p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
          open && "bg-muted text-foreground"
        )}
      >
        <Bot className="h-5 w-5" aria-hidden />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          dir={isRtl ? "rtl" : "ltr"}
          role="dialog"
          aria-label={tt("title", "AI Business Assistant")}
          style={{ position: "fixed", left: pos.x, top: pos.y, width: PANEL_WIDTH, maxHeight: PANEL_MAX_HEIGHT, zIndex: 9999 }}
          className="flex flex-col select-none rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden font-sans"
        >
          <div
            className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/60 border-b border-border cursor-move touch-none shrink-0"
            onMouseDown={(e) => { e.preventDefault(); beginDrag(e.clientX, e.clientY); }}
            onTouchStart={(e) => { const tch = e.touches[0]; if (tch) beginDrag(tch.clientX, tch.clientY); }}
          >
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
              {tt("title", "AI Business Assistant")}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setMinimized((m) => !m)} aria-label={minimized ? tt("restore", "Restore") : tt("minimize", "Minimize")} title={minimized ? tt("restore", "Restore") : tt("minimize", "Minimize")} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground transition-colors">
                <Minus className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label={tt("close", "Close")} title={tt("close", "Close")} className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              <p className="px-3 pt-2 text-[10px] leading-snug text-slate-400">
                {tt("disclaimer", "Read-only — answers use your existing ERP data only. It can never create, edit, delete or post any transaction.")}
              </p>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ minHeight: 120, maxHeight: 280 }}>
                {messages.length === 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-semibold text-slate-500">{tt("examples_title", "Try asking")}</p>
                    {EXAMPLES.map((ex, i) => (
                      <button key={i} type="button" onClick={() => void send(ex)} className="block w-full rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-start text-[11px] text-foreground hover:bg-muted transition-colors">
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs leading-snug",
                        m.role === "user" && "bg-indigo-600 text-white",
                        m.role === "assistant" && !m.refused && "bg-muted text-foreground",
                        m.role === "assistant" && m.refused && "bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-700/60"
                      )}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-xl bg-muted px-2.5 py-1.5 text-xs text-slate-500">{tt("thinking", "Thinking…")}</div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 border-t border-border p-2 shrink-0">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void send(); } }}
                  placeholder={tt("placeholder", "Ask about profit, balance sheet, cash, purchases, sales, outstanding…")}
                  className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={loading || !question.trim()}
                  aria-label={tt("send", "Ask")}
                  className="shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white p-1.5 transition-colors"
                >
                  <Send className={cn("h-3.5 w-3.5", isRtl && "-scale-x-100")} aria-hidden />
                </button>
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
