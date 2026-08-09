"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

function clearChunkReloadCache() {
  try {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("chunk_reload_attempt");
        sessionStorage.removeItem("chunk_reload_timestamp");
        sessionStorage.removeItem("erp_chunk_reload_timestamp");
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && (key.startsWith("chunk_reload") || key.startsWith("erp_chunk_reload"))) {
            sessionStorage.removeItem(key);
          }
        }
      } catch (e) {}

      if (window.isSecureContext && "serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister());
        }).catch(() => {});
      }
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        }).catch(() => {});
      }
    }
  } catch (e) {}
}

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard client-side exception caught:", error);
    
    const msg = String(error?.message || error || "");
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      msg.includes("Loading chunk") ||
      msg.includes("ChunkLoadError") ||
      msg.includes("failed to fetch") ||
      msg.includes("Failed to fetch dynamically imported module") ||
      (msg.toLowerCase().includes("failed to fetch") && msg.includes("_next/static"));

    if (isChunkError) {
      const countKey = "erp_auto_chunk_cnt";
      const currentCount = parseInt(sessionStorage.getItem(countKey) || "0", 10);
      const now = Date.now();

      if (currentCount < 3) {
        clearChunkReloadCache();
        sessionStorage.setItem(countKey, String(currentCount + 1));
        window.location.replace(window.location.pathname + "?_v=" + now);
        return;
      }
    }
  }, [error]);

  const handleTryAgain = () => {
    clearChunkReloadCache();
    window.location.href = window.location.pathname + "?_t=" + Date.now();
  };

  return (
    <div className="p-6 max-w-xl mx-auto my-12 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          Module Temporary Exception
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          This dashboard module encountered a temporary chunk loading error after a system update. Click below to reload fresh assets.
        </p>
        {error && (
          <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-left font-mono text-[10.5px] text-rose-600 dark:text-rose-400 overflow-x-auto">
            {typeof error.message === "string"
              ? error.message
              : typeof error.message === "object" && error.message !== null
              ? JSON.stringify(error.message)
              : typeof error === "string"
              ? error
              : JSON.stringify(error)}
          </div>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            type="button"
            onClick={handleTryAgain}
            className="h-9 bg-blue-600 hover:bg-blue-700 font-bold text-xs gap-1.5"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> Try Again (Reload)
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              clearChunkReloadCache();
              window.location.href = "/dashboard";
            }}
            className="h-9 font-bold text-xs gap-1.5"
          >
            <LayoutDashboard className="h-3.5 w-3.5" /> Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
