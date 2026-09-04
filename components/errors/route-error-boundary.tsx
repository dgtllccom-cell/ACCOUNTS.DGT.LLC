"use client";

import { useEffect } from "react";
import { RefreshCcw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

/**
 * Shared route-level error boundary UI + chunk-load auto-recovery, reused by every
 * `app/**\/error.tsx` segment (purchase, sales, settings, new-entry, dashboard root,
 * etc). Each of those files used to re-implement this from scratch with slightly
 * different session-storage keys, retry counts and thresholds, and none of them were
 * translated. One shared implementation now backs all of them — fix once, benefit
 * everywhere, per the ERP shared-solution rule.
 */

const ACCENT_CLASSES: Record<string, { bg: string; text: string; button: string }> = {
  blue: { bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-600 dark:text-blue-400", button: "bg-blue-600 hover:bg-blue-700" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/50", text: "text-emerald-600 dark:text-emerald-400", button: "bg-emerald-600 hover:bg-emerald-700" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/50", text: "text-amber-600 dark:text-amber-400", button: "bg-cyan-600 hover:bg-cyan-700" },
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/50", text: "text-indigo-600 dark:text-indigo-400", button: "bg-indigo-600 hover:bg-indigo-700" },
  rose: { bg: "bg-rose-50 dark:bg-rose-950/50", text: "text-rose-600 dark:text-rose-400", button: "bg-blue-600 hover:bg-blue-700" },
};

function isChunkLoadError(error: Error & { digest?: string }): boolean {
  const msg = String(error?.message || error || "");
  return (
    error?.name === "ChunkLoadError" ||
    msg.includes("Loading chunk") ||
    msg.includes("ChunkLoadError") ||
    msg.includes("failed to fetch") ||
    msg.includes("Failed to fetch dynamically imported module") ||
    (msg.toLowerCase().includes("failed to fetch") && msg.includes("_next/static"))
  );
}

function clearChunkReloadCache(scopeKey: string) {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem("chunk_reload_attempt");
    sessionStorage.removeItem("erp_chunk_reload_timestamp");
    sessionStorage.removeItem(`erp_route_err_cnt_${scopeKey}`);
    sessionStorage.removeItem(`erp_route_err_ts_${scopeKey}`);
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith("chunk_reload") || key.startsWith("erp_chunk_reload") || key.startsWith("erp_route_err_"))) {
        sessionStorage.removeItem(key);
      }
    }
    if (window.isSecureContext && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
    }
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  } catch {}
}

function hardReloadFresh() {
  try {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("_v", String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    if (typeof window !== "undefined") window.location.reload();
  }
}

export type RouteErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Unique per route segment (e.g. "purchase", "sales", "settings") — namespaces the auto-reload counter so segments never interfere with each other. */
  scopeKey: string;
  icon: LucideIcon;
  accent?: keyof typeof ACCENT_CLASSES;
  titleKey: string;
  titleFallback: string;
  messageKey: string;
  messageFallback: string;
  retryLabelKey?: string;
  retryLabelFallback?: string;
  secondaryHref?: string;
  secondaryIcon?: LucideIcon;
  secondaryLabelKey?: string;
  secondaryLabelFallback?: string;
  /** Max automatic chunk-error reloads within the time window before giving up and showing the manual UI. Default 2. */
  maxAutoReloads?: number;
  /** Window (ms) after which the auto-reload counter resets. Default 20000. */
  autoReloadWindowMs?: number;
};

export function RouteErrorBoundary({
  error,
  reset,
  scopeKey,
  icon: Icon,
  accent = "blue",
  titleKey,
  titleFallback,
  messageKey,
  messageFallback,
  retryLabelKey = "routeerr.try_again",
  retryLabelFallback = "Try Again (Reload)",
  secondaryHref = "/dashboard",
  secondaryIcon,
  secondaryLabelKey = "routeerr.go_to_dashboard",
  secondaryLabelFallback = "Go to Dashboard",
  maxAutoReloads = 2,
  autoReloadWindowMs = 20000,
}: RouteErrorBoundaryProps) {
  const lang = useActiveLanguage();
  const tt = (key: string, fallback: string) => t(lang, key as never, fallback);
  const SecondaryIcon = secondaryIcon;
  const colors = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.blue;

  useEffect(() => {
    console.error(`[RouteErrorBoundary:${scopeKey}] exception caught:`, error);
    if (!isChunkLoadError(error)) return;

    const countKey = `erp_route_err_cnt_${scopeKey}`;
    const tsKey = `erp_route_err_ts_${scopeKey}`;
    const now = Date.now();
    try {
      const lastTs = parseInt(sessionStorage.getItem(tsKey) || "0", 10);
      let count = parseInt(sessionStorage.getItem(countKey) || "0", 10);
      if (now - lastTs > autoReloadWindowMs) count = 0;

      if (count < maxAutoReloads) {
        sessionStorage.setItem(countKey, String(count + 1));
        sessionStorage.setItem(tsKey, String(now));
        const timer = setTimeout(() => hardReloadFresh(), 500);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [error, scopeKey, maxAutoReloads, autoReloadWindowMs]);

  const handleRetry = () => {
    clearChunkReloadCache(scopeKey);
    reset();
    hardReloadFresh();
  };

  return (
    <div className="p-6 max-w-xl mx-auto my-12 text-center" dir={["ur", "ar", "fa", "ps"].includes(lang) ? "rtl" : "ltr"}>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${colors.bg} ${colors.text}`}>
          <Icon className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          {tt(titleKey, titleFallback)}
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {tt(messageKey, messageFallback)}
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-slate-900 p-3.5 text-left font-mono text-[10.5px] text-blue-300 overflow-x-auto border border-slate-800" dir="ltr">
            {typeof error.message === "string"
              ? error.message
              : typeof error === "string"
              ? error
              : JSON.stringify(error)}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            type="button"
            onClick={handleRetry}
            className={`h-10 ${colors.button} text-white font-bold text-xs gap-2 px-5 rounded-xl shadow-md`}
          >
            <RefreshCcw className="h-4 w-4" /> {tt(retryLabelKey, retryLabelFallback)}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              clearChunkReloadCache(scopeKey);
              window.location.href = secondaryHref;
            }}
            className="h-10 font-bold text-xs gap-2 px-5 rounded-xl border-slate-300 dark:border-slate-700"
          >
            {SecondaryIcon && <SecondaryIcon className="h-4 w-4" />} {tt(secondaryLabelKey, secondaryLabelFallback)}
          </Button>
        </div>
      </div>
    </div>
  );
}
